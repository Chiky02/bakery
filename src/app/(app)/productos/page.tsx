"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Producto } from "@/types";
import { formatCOP } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function ProductosPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [search, setSearch] = useState("");

  async function load() {
    const supabase = createClient();
    const { data } = await supabase
      .from("productos")
      .select("*, categorias(*)")
      .order("orden");
    setProductos((data as Producto[]) ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleDisponible(id: string, disponible: boolean) {
    const supabase = createClient();
    await supabase.from("productos").update({ disponible: !disponible }).eq("id", id);
    load();
  }

  const filtered = productos.filter((p) =>
    p.nombre.toLowerCase().includes(search.toLowerCase()),
  );

  const byCat = filtered.reduce<Record<string, Producto[]>>((acc, p) => {
    const cat = p.categorias?.nombre ?? "Otros";
    (acc[cat] ??= []).push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Productos</h1>
        <p className="text-sm text-stone-500">
          Disponibilidad manual — sin inventario de unidades
        </p>
      </div>

      <Input
        placeholder="Buscar producto..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {Object.entries(byCat).map(([cat, items]) => (
        <Card key={cat}>
          <CardTitle>{cat}</CardTitle>
          <ul className="mt-4 divide-y">
            {items.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{p.nombre}</p>
                  <p className="text-sm text-stone-500">{formatCOP(p.precio)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge color={p.disponible ? "success" : "danger"}>
                    {p.disponible ? "Disponible" : "Agotado"}
                  </Badge>
                  <Button
                    size="sm"
                    variant={p.disponible ? "secondary" : "primary"}
                    onClick={() => toggleDisponible(p.id, p.disponible)}
                  >
                    {p.disponible ? "Marcar agotado" : "Marcar disponible"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
