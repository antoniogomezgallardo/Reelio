'use client';

import { useEffect } from 'react';

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    console.error('UI error boundary', {
      message: error.message,
      stack: error.stack,
      digest: error.digest,
    });
  }, [error]);

  return (
    <html lang="es">
      <body style={{ background: '#0e0f13', color: '#f7f4ef' }}>
        <main
          style={{
            minHeight: '100vh',
            display: 'grid',
            placeItems: 'center',
            padding: '48px',
          }}
        >
          <div style={{ maxWidth: '520px', textAlign: 'center' }}>
            <h1 style={{ fontSize: '24px', marginBottom: '12px' }}>
              Algo salio mal
            </h1>
            <p style={{ color: '#b6b2a7', marginBottom: '24px' }}>
              Hemos registrado el error. Prueba a recargar la pagina.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{
                background: '#ffb347',
                border: 'none',
                borderRadius: '999px',
                color: '#1f1404',
                padding: '10px 18px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Reintentar
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
