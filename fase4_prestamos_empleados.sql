-- ═══════════════════════════════════════════════════════════════
--  FASE 4.1 — PRÉSTAMOS Y ANTICIPOS A EMPLEADOS
--  Ejecutar en: Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ┌─────────────────────────────────────────────────────────────┐
-- │  1. TABLA: PRÉSTAMOS / ANTICIPOS A EMPLEADOS               │
-- └─────────────────────────────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS prestamos_empleados (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa               text NOT NULL CHECK (empresa IN ('tycoon','diaz')),
  empleado_id           uuid,
  empleado_nombre       text NOT NULL,
  -- Tipo: prestamo = cuotas fijas | anticipo = descuento en siguiente nómina
  tipo                  text NOT NULL CHECK (tipo IN ('prestamo','anticipo')),
  monto_total           numeric(18,4) NOT NULL CHECK (monto_total > 0),
  num_cuotas            int NOT NULL DEFAULT 1 CHECK (num_cuotas >= 1),
  valor_cuota           numeric(18,4) NOT NULL CHECK (valor_cuota > 0),
  cuotas_pagadas        int NOT NULL DEFAULT 0,
  saldo_pendiente       numeric(18,4) NOT NULL,
  moneda                text NOT NULL DEFAULT 'USD' CHECK (moneda IN ('USD','COP','EUR')),
  -- Fechas
  fecha_desembolso      date NOT NULL DEFAULT CURRENT_DATE,
  fecha_inicio_descuento date NOT NULL,
  -- Contabilización
  cuenta_contable       text DEFAULT '1399',   -- CxC del empleado
  comprobante_desembolso_id uuid REFERENCES comprobantes(id) ON DELETE SET NULL,
  -- Estado
  estado                text NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo','pagado','cancelado')),
  notas                 text,
  -- Auditoría
  created_by            text,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

COMMENT ON TABLE prestamos_empleados IS 'Préstamos y anticipos a empleados. Se descuentan automáticamente de la nómina según cuotas parametrizadas.';

CREATE INDEX IF NOT EXISTS idx_prest_emp_empresa ON prestamos_empleados(empresa);
CREATE INDEX IF NOT EXISTS idx_prest_emp_empleado ON prestamos_empleados(empleado_id);
CREATE INDEX IF NOT EXISTS idx_prest_emp_estado ON prestamos_empleados(estado);

-- ┌─────────────────────────────────────────────────────────────┐
-- │  2. TABLA: HISTORIAL DE DESCUENTOS (cuotas aplicadas)      │
-- └─────────────────────────────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS prestamos_descuentos (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  prestamo_id           uuid NOT NULL REFERENCES prestamos_empleados(id) ON DELETE CASCADE,
  nomina_pago_id        uuid,     -- referencia al pago de nómina donde se descontó
  comprobante_id        uuid REFERENCES comprobantes(id) ON DELETE SET NULL,
  numero_cuota          int NOT NULL,
  valor_descontado      numeric(18,4) NOT NULL,
  saldo_despues         numeric(18,4) NOT NULL,
  fecha_descuento       date NOT NULL DEFAULT CURRENT_DATE,
  created_at            timestamptz DEFAULT now()
);

COMMENT ON TABLE prestamos_descuentos IS 'Registro de cada cuota descontada de un préstamo/anticipo. Trazabilidad completa.';

CREATE INDEX IF NOT EXISTS idx_prest_desc_prestamo ON prestamos_descuentos(prestamo_id);

-- ┌─────────────────────────────────────────────────────────────┐
-- │  3. COLUMNA: contabilizado en nomina_pagos                 │
-- └─────────────────────────────────────────────────────────────┘

ALTER TABLE nomina_pagos ADD COLUMN IF NOT EXISTS contabilizado boolean DEFAULT false;
ALTER TABLE nomina_pagos ADD COLUMN IF NOT EXISTS comprobante_id uuid REFERENCES comprobantes(id) ON DELETE SET NULL;
ALTER TABLE nomina_pagos ADD COLUMN IF NOT EXISTS comprobante_rc_id uuid REFERENCES comprobantes(id) ON DELETE SET NULL;

COMMENT ON COLUMN nomina_pagos.contabilizado IS 'true si ya se generó el CE contable para este pago';
COMMENT ON COLUMN nomina_pagos.comprobante_id IS 'ID del CE generado al contabilizar';
COMMENT ON COLUMN nomina_pagos.comprobante_rc_id IS 'ID del RC si se generó préstamo de socio/tercero para pagar';

-- ┌─────────────────────────────────────────────────────────────┐
-- │  4. RLS + POLÍTICAS                                        │
-- └─────────────────────────────────────────────────────────────┘

ALTER TABLE prestamos_empleados ENABLE ROW LEVEL SECURITY;
ALTER TABLE prestamos_descuentos ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE tname text;
BEGIN
  FOREACH tname IN ARRAY ARRAY['prestamos_empleados','prestamos_descuentos']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname='public' AND tablename=tname AND policyname='auth_only'
    ) THEN
      EXECUTE format(
        'CREATE POLICY "auth_only" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
        tname
      );
    END IF;
  END LOOP;
END $$;

-- ┌─────────────────────────────────────────────────────────────┐
-- │  5. SUBCUENTAS CxC POR EMPLEADO (se crearán desde la UI)  │
-- │     Ejemplo: 1399-EMP01 — CxC Juan Pérez                  │
-- │     Se crean automáticamente al otorgar el préstamo        │
-- └─────────────────────────────────────────────────────────────┘

-- ┌─────────────────────────────────────────────────────────────┐
-- │  6. VISTA: PRÉSTAMOS ACTIVOS CON SALDO                     │
-- └─────────────────────────────────────────────────────────────┘

CREATE OR REPLACE VIEW vista_prestamos_activos AS
SELECT
  p.id,
  p.empresa,
  p.empleado_id,
  p.empleado_nombre,
  p.tipo,
  p.monto_total,
  p.num_cuotas,
  p.valor_cuota,
  p.cuotas_pagadas,
  p.saldo_pendiente,
  p.moneda,
  p.fecha_desembolso,
  p.fecha_inicio_descuento,
  p.cuenta_contable,
  p.estado,
  p.notas,
  -- Próxima cuota
  p.cuotas_pagadas + 1 AS proxima_cuota,
  -- Porcentaje pagado
  CASE WHEN p.num_cuotas > 0
    THEN ROUND((p.cuotas_pagadas::numeric / p.num_cuotas) * 100, 1)
    ELSE 0
  END AS porcentaje_pagado
FROM prestamos_empleados p
WHERE p.estado = 'activo'
ORDER BY p.empresa, p.empleado_nombre;

-- ┌─────────────────────────────────────────────────────────────┐
-- │  7. VERIFICACIÓN                                           │
-- └─────────────────────────────────────────────────────────────┘

SELECT 'prestamos_empleados' AS tabla, COUNT(*) AS filas FROM prestamos_empleados
UNION ALL
SELECT 'prestamos_descuentos', COUNT(*) FROM prestamos_descuentos;

-- Verificar columnas nuevas en nomina_pagos
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'nomina_pagos'
  AND column_name IN ('contabilizado','comprobante_id','comprobante_rc_id')
ORDER BY column_name;

-- ═══════════════════════════════════════════════════════════════
--  FIN — Tablas: prestamos_empleados, prestamos_descuentos
--  Vista: vista_prestamos_activos
--  Columnas nuevas en nomina_pagos: contabilizado, comprobante_id, comprobante_rc_id
-- ═══════════════════════════════════════════════════════════════
