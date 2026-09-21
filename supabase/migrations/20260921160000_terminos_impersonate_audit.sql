-- Términos y condiciones versionados + aceptaciones + auditoría de acceso de soporte.

CREATE TABLE IF NOT EXISTS terminos_versiones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL,
  titulo TEXT NOT NULL DEFAULT 'Términos y condiciones',
  contenido TEXT NOT NULL,
  vigente BOOLEAN NOT NULL DEFAULT false,
  publicada_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (version)
);

CREATE UNIQUE INDEX IF NOT EXISTS terminos_versiones_una_vigente
  ON terminos_versiones ((vigente))
  WHERE vigente = true;

CREATE TABLE IF NOT EXISTS terminos_aceptaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  terminos_version_id UUID NOT NULL REFERENCES terminos_versiones(id) ON DELETE CASCADE,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, terminos_version_id)
);

CREATE INDEX IF NOT EXISTS idx_terminos_aceptaciones_user
  ON terminos_aceptaciones (user_id);

CREATE TABLE IF NOT EXISTS auditoria_soporte (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operador_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  modo TEXT NOT NULL CHECK (modo IN ('rol', 'usuario', 'salida')),
  objetivo_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  panaderia_id UUID REFERENCES panaderias(id) ON DELETE SET NULL,
  detalle TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_soporte_created
  ON auditoria_soporte (created_at DESC);

ALTER TABLE terminos_versiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE terminos_aceptaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria_soporte ENABLE ROW LEVEL SECURITY;

-- Lectura de versiones: cualquier autenticado (para aceptar / consultar)
DROP POLICY IF EXISTS "terminos_versiones_select" ON terminos_versiones;
CREATE POLICY "terminos_versiones_select" ON terminos_versiones
  FOR SELECT TO authenticated USING (true);

-- Aceptaciones: cada usuario ve/inserta las propias
DROP POLICY IF EXISTS "terminos_aceptaciones_select_own" ON terminos_aceptaciones;
CREATE POLICY "terminos_aceptaciones_select_own" ON terminos_aceptaciones
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "terminos_aceptaciones_insert_own" ON terminos_aceptaciones;
CREATE POLICY "terminos_aceptaciones_insert_own" ON terminos_aceptaciones
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Auditoría: solo operadores de plataforma pueden leer (escritura vía service role)
DROP POLICY IF EXISTS "auditoria_soporte_select_platform" ON auditoria_soporte;
CREATE POLICY "auditoria_soporte_select_platform" ON auditoria_soporte
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.plataforma_admin = true
    )
  );

-- Versión inicial 1.0 (contenido alineado al producto / Ley 1581)
INSERT INTO terminos_versiones (version, titulo, contenido, vigente, publicada_at)
SELECT
  '1.0',
  'Términos y condiciones de uso del panel',
  $TC$
TÉRMINOS Y CONDICIONES DE USO DEL PANEL DE GESTIÓN
Versión 1.0 — República de Colombia

Estos términos regulan el acceso y uso del software de gestión para panaderías y negocios de alimentos (en adelante, el “Panel” o el “Servicio”), puesto a disposición por el operador de la plataforma (en adelante, el “Operador”).

Al crear una cuenta, iniciar sesión o hacer clic en “Aceptar”, usted declara haber leído, entendido y aceptado estos términos en su versión vigente. Si no está de acuerdo, debe abstenerse de usar el Servicio.

1. OBJETO DEL SERVICIO
El Panel es una herramienta tecnológica para la operación diaria del negocio: registro de ventas de mostrador, gestión de mesas y pedidos, cocina, caja y turnos, encargos, recepciones de mercancía, catálogo de productos e insumos, inventario, clientes, reportes, facturación comercial interna, configuración del local y administración del equipo de trabajo.
El Servicio se presta bajo un modelo de software como servicio (SaaS) multinegocio: cada local/panadería mantiene su propia información operativa dentro del Panel.

2. CUENTAS, ROLES Y ACCESO
El acceso se realiza mediante correo y contraseña. El dueño o administrador de cada local es responsable de invitar, asignar roles (por ejemplo mostrador, mesero, cocina, caja, gerente) y desactivar cuentas de su equipo.
Usted se compromete a: (a) proporcionar datos veraces; (b) custodiar sus credenciales; (c) notificar de inmediato cualquier uso no autorizado; (d) usar el Panel solo para fines lícitos relacionados con la operación del negocio.

3. RESPONSABLE DEL TRATAMIENTO Y DATOS PERSONALES (LEY 1581 DE 2012)
Para los datos de clientes, empleados u otros titulares que el negocio registre en el Panel, el responsable del tratamiento es el negocio/local usuario del Servicio. El Operador actúa como encargado del tratamiento en la medida en que aloja, procesa y resguarda esa información para prestar el Servicio.
El Operador tratará datos personales conforme a la Ley 1581 de 2012, sus decretos reglamentarios y la política de privacidad aplicable, con finalidades de: prestar y mejorar el Servicio; seguridad; soporte; cumplimiento legal; y comunicaciones operativas del Panel.
Usted (como dueño o administrador del local) debe informar a su equipo y, cuando corresponda, a sus clientes sobre el uso del Panel y obtener las autorizaciones que la ley exija.

4. SOPORTE TÉCNICO Y ACCESO AUTORIZADO DEL OPERADOR
Para prestar asistencia técnica, diagnosticar fallas, garantizar la seguridad, prevenir abusos y mantener la continuidad del Servicio, el Operador podrá acceder de forma controlada a la información operativa del Panel y visualizar la experiencia de uso asociada a roles o cuentas del equipo del local, siempre con finalidad de soporte, seguridad o mantenimiento.
Dichos accesos se realizan respetando principios de finalidad, necesidad y confidencialidad. El Operador llevará registro interno de intervenciones relevantes de soporte. Este acceso no implica cesión de la propiedad de los datos del negocio ni autoriza usos ajenos a las finalidades aquí descritas.

5. CONTENIDO Y DATOS DEL NEGOCIO
La información cargada por el local (productos, ventas, encargos, clientes, inventario, etc.) es de titularidad del negocio usuario. El Operador no reclama propiedad sobre ese contenido, salvo los derechos necesarios para alojarlo y operar el Servicio.
Usted es responsable de la exactitud de la información y del cumplimiento de obligaciones comerciales, laborales, tributarias y sanitarias aplicables a su actividad.

6. MÓDULOS PÚBLICOS Y PEDIDOS
Algunas funciones (por ejemplo encargos desde el sitio público o pedidos por código QR de mesa) permiten que terceros interactúen con el negocio. El local es responsable de atender esos pedidos, de la calidad del producto/servicio y de las condiciones que comunique a sus clientes.

7. DOCUMENTOS COMERCIALES
Las “facturas” o comprobantes generados por el Panel son documentos de apoyo comercial interno del negocio. Salvo indicación expresa en contrario, no constituyen factura electrónica DIAN ni sustituyen las obligaciones fiscales del usuario ante la autoridad tributaria colombiana.

8. DISPONIBILIDAD Y LIMITACIÓN DE RESPONSABILIDAD
El Operador procura la disponibilidad razonable del Servicio, sin garantizar un funcionamiento ininterrumpido o libre de errores. En la máxima medida permitida por la ley colombiana, el Operador no será responsable por daños indirectos, lucro cesante, pérdida de datos atribuible a causas ajenas a su control razonable, o decisiones de negocio tomadas con base en la información del Panel.
Nada de lo anterior limita derechos irrenunciables del consumidor o usuario cuando la ley los declare aplicables.

9. PROHIBICIONES
Queda prohibido: intentar vulnerar la seguridad del sistema; usar el Panel para actividades ilícitas; compartir credenciales de forma insegura; interferir con otros negocios alojados en la plataforma; o extraer datos de terceros sin autorización.

10. MODIFICACIONES Y VERSIONES
El Operador puede actualizar estos términos. Cada versión tendrá un número identificable. Cuando se publique una nueva versión vigente, el Panel podrá solicitar nuevamente su aceptación antes de continuar. El uso continuado tras aceptar la nueva versión implica conformidad con ella.

11. TERMINACIÓN
El Operador o el usuario pueden terminar el acceso conforme a lo pactado comercialmente. A la terminación, se aplicarán las reglas de retención y eliminación de datos previstas en la política de privacidad y en la ley.

12. LEGISLACIÓN Y CONTROVERSIAS
Estos términos se rigen por las leyes de la República de Colombia. Cualquier controversia se someterá a los jueces competentes del domicilio del Operador en Colombia, sin perjuicio de normas imperativas de protección al consumidor cuando resulten aplicables.

13. CONTACTO
Para ejercer derechos de habeas data (conocer, actualizar, rectificar, suprimir) o consultas sobre estos términos, utilice los canales de soporte publicados por el Operador en el Panel o en el sitio del Servicio.

Al aceptar, usted confirma que tiene capacidad legal para obligarse (o actúa en representación del negocio) y que acepta la versión vigente de estos términos.
$TC$,
  true,
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM terminos_versiones WHERE version = '1.0'
);
