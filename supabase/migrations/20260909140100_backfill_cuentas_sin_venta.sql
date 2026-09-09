-- Históricas en $0 → cancelada (tras commit del enum en migración anterior)
UPDATE cuentas_mesa
SET estado = 'cancelada',
    medio_pago = NULL,
    turno_id = NULL
WHERE estado = 'cerrada'
  AND COALESCE(total_final, 0) <= 0;
