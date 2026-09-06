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

async function seed() {
  console.log("🥐 Sembrando Panadería Sissa...\n");

  await supabase.from("config_negocio").upsert({
    id: 1,
    nombre: data.negocio.nombre,
    moneda: data.negocio.moneda,
    pedido_directo_habilitado: false,
    requiere_aprobacion_mesero: true,
  });

  const { data: categorias, error: catErr } = await supabase
    .from("categorias")
    .upsert(data.categorias, { onConflict: "nombre" })
    .select();
  if (catErr) throw catErr;

  const catMap = new Map(categorias!.map((c) => [c.nombre, c.id]));

  const productosPayload = data.productos.map((p) => ({
    categoria_id: catMap.get(p.categoria) ?? catMap.get("Galletas y pasteles")!,
    nombre: p.nombre,
    precio: p.precio,
    disponible: p.disponible,
    orden: p.orden,
  }));

  const { error: prodErr } = await supabase
    .from("productos")
    .upsert(productosPayload, { onConflict: "categoria_id,nombre" });
  if (prodErr) {
    await supabase.from("productos").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    const { error: insertErr } = await supabase.from("productos").insert(productosPayload);
    if (insertErr) throw insertErr;
  }

  const { error: mesaErr } = await supabase
    .from("mesas")
    .upsert(
      data.mesas.map((m) => ({ ...m, estado: "libre", qr_habilitado: true })),
      { onConflict: "nombre" },
    );
  if (mesaErr) throw mesaErr;

  for (const u of data.usuarios) {
    const { data: existing } = await supabase.auth.admin.listUsers();
    const found = existing?.users.find((x) => x.email === u.email);

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
      rol: u.rol,
      activo: true,
    });
  }

  console.log(`\n✅ Listo: ${data.categorias.length} categorías, ${data.productos.length} productos, ${data.mesas.length} mesas`);
  console.log("\nCredenciales de prueba (cambiar en producción):");
  for (const u of data.usuarios) {
    console.log(`  ${u.rol.padEnd(10)} → ${u.email} / ${u.password}`);
  }
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
