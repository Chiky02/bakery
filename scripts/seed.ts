import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";

type SeedData = {
  negocio: { nombre: string; moneda: string };
  categorias: { nombre: string; medida: string; orden: number }[];
  productos: {
    categoria: string;
    nombre: string;
    precio: number;
    disponible: boolean;
    orden: number;
  }[];
  mesas: { nombre: string; zona: string }[];
  usuarios: {
    email: string;
    password: string;
    nombre: string;
    rol: string;
  }[];
};

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const data: SeedData = JSON.parse(
  readFileSync(join(process.cwd(), "supabase/seed-data.json"), "utf-8"),
);

async function ensurePanaderia() {
  const { data: existing } = await supabase
    .from("panaderias")
    .select("*")
    .eq("slug", "bakerychiky02")
    .maybeSingle();

  if (existing) {
    await supabase
      .from("panaderias")
      .update({
        nombre: "BakeryChiky02",
        moneda: data.negocio.moneda,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    return existing.id as string;
  }

  const { data: created, error } = await supabase
    .from("panaderias")
    .insert({
      nombre: "BakeryChiky02",
      slug: "bakerychiky02",
      moneda: data.negocio.moneda,
      pedido_directo_habilitado: false,
      requiere_aprobacion_mesero: true,
    })
    .select()
    .single();
  if (error) throw error;
  return created.id as string;
}

async function seed() {
  console.log("🥐 Sembrando BakeryChiky02 (multitenant)...\n");

  const panaderiaId = await ensurePanaderia();
  console.log(`  · Panadería: BakeryChiky02 (${panaderiaId})\n`);

  const { data: categorias, error: catErr } = await supabase
    .from("categorias")
    .upsert(
      data.categorias.map((c) => ({ ...c, panaderia_id: panaderiaId })),
      { onConflict: "panaderia_id,nombre" },
    )
    .select();
  if (catErr) throw catErr;

  const catMap = new Map(categorias!.map((c) => [c.nombre, c.id]));
  const fallbackPostres = catMap.get("Tortas y postres") ?? catMap.get("Galletas y pasteles")!;
  const fallbackPan = catMap.get("Panadería") ?? fallbackPostres;

  const productosPayload = data.productos.map((p) => {
    const knownId = catMap.get(p.categoria);
    const numericName = /^\d+$/.test(p.nombre);
    if (!knownId && numericName) {
      const isPan = /pan /i.test(p.categoria);
      return {
        panaderia_id: panaderiaId,
        categoria_id: isPan ? fallbackPan : fallbackPostres,
        nombre: p.categoria,
        precio: Number(p.nombre) || p.precio,
        disponible: p.disponible,
        orden: p.orden,
      };
    }
    return {
      panaderia_id: panaderiaId,
      categoria_id: knownId ?? fallbackPostres,
      nombre: p.nombre,
      precio: p.precio,
      disponible: p.disponible,
      orden: p.orden,
    };
  });

  const uniqueProductos = [
    ...new Map(productosPayload.map((p) => [`${p.categoria_id}:${p.nombre}`, p])).values(),
  ];

  const { error: prodErr } = await supabase
    .from("productos")
    .upsert(uniqueProductos, { onConflict: "panaderia_id,categoria_id,nombre" });
  if (prodErr) {
    console.warn("Upsert de productos falló, reinsertando limpio:", prodErr.message);
    await supabase.from("productos").delete().eq("panaderia_id", panaderiaId);
    const { error: insertErr } = await supabase.from("productos").insert(uniqueProductos);
    if (insertErr) throw insertErr;
  }

  await supabase
    .from("productos")
    .delete()
    .eq("panaderia_id", panaderiaId)
    .filter("nombre", "match", "^[0-9]+$");

  const { error: mesaErr } = await supabase.from("mesas").upsert(
    data.mesas.map((m) => ({
      ...m,
      panaderia_id: panaderiaId,
      estado: "libre",
      qr_habilitado: true,
    })),
    { onConflict: "panaderia_id,nombre" },
  );
  if (mesaErr) throw mesaErr;

  const { data: existingUsers, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) throw listErr;

  for (const u of data.usuarios) {
    const found = existingUsers?.users.find((x) => x.email === u.email);

    let userId = found?.id;
    if (!found) {
      const { data: created, error } = await supabase.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { nombre: u.nombre },
      });
      if (error) throw error;
      userId = created.user.id;
      console.log(`  ✓ Usuario creado: ${u.email}`);
    } else {
      console.log(`  · Usuario existente: ${u.email}`);
    }

    await supabase.from("profiles").upsert({
      id: userId,
      nombre: u.nombre,
      activo: true,
      panaderia_activa_id: panaderiaId,
    });

    await supabase.from("miembros").upsert(
      {
        panaderia_id: panaderiaId,
        user_id: userId,
        rol: u.rol,
        activo: true,
      },
      { onConflict: "panaderia_id,user_id" },
    );
  }

  // Proveedor demo
  await supabase.from("proveedores").upsert(
    {
      panaderia_id: panaderiaId,
      nombre: "Distribuidora Central",
      telefono: "3000000000",
      notas: "Proveedor de demostración",
    },
    { onConflict: "panaderia_id,nombre" },
  );

  console.log(
    `\n✅ Listo: BakeryChiky02 — ${data.categorias.length} categorías, ${uniqueProductos.length} productos, ${data.mesas.length} mesas`,
  );
  console.log("\nCredenciales de prueba (cambiar en producción):");
  for (const u of data.usuarios) {
    console.log(`  ${u.rol.padEnd(10)} → ${u.email} / ${u.password}`);
  }
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
