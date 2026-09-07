-- Notificaciones: permitir borrar las propias
DROP POLICY IF EXISTS "notificaciones_delete" ON notificaciones;
CREATE POLICY "notificaciones_delete" ON notificaciones FOR DELETE TO authenticated
  USING (user_id = auth.uid());
