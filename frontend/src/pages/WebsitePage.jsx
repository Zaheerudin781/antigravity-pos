import { useState, useEffect, useRef } from 'react';
import { useApp } from '../store/AppContext';
import api from '../api/axios';
import QRCode from 'qrcode';

export default function WebsitePage() {
  const { notify } = useApp();
  const [loading, setLoading] = useState(true);
  const [published, setPublished] = useState(false);
  const [slug, setSlug] = useState('');
  const [businessName, setBusinessName] = useState('');
  const canvasRef = useRef(null);

  const fetchStatus = async () => {
    try {
      const { data } = await api.get('/website');
      setPublished(data.isPublished);
      setSlug(data.slug);
      setBusinessName(data.businessName);
    } catch {
      notify('Failed to load website settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const publicUrl = `http://localhost:3000/menu/${slug}`;

  useEffect(() => {
    if (published && slug && canvasRef.current) {
      QRCode.toCanvas(
        canvasRef.current,
        publicUrl,
        {
          width: 220,
          margin: 2,
          color: {
            dark: '#1a1a2e',
            light: '#ffffff',
          },
        },
        (error) => {
          if (error) console.error('QR code generation error:', error);
        }
      );
    }
  }, [published, slug, publicUrl]);

  const handleToggle = async () => {
    try {
      const { data } = await api.post('/website/toggle');
      setPublished(data.isPublished);
      notify(`Public website ${data.isPublished ? 'published!' : 'taken offline.'}`);
    } catch {
      notify('Failed to update website status', 'error');
    }
  };

  if (loading) return <div className="spinner" />;

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1>Public Menu Website</h1>
          <p>Publish your digital menu online and generate scan-to-order QR codes</p>
        </div>
      </div>

      <div className="card mb-12">
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>QR Menu Configuration</h2>
        <p className="text-muted text-sm mb-16">
          When published, customer devices can scan your QR code or navigate to your slug url to view available menus, category selections, modifiers, and prices.
        </p>

        <div className="toggle-wrap" style={{ border: '1px solid var(--gray-200)', padding: 16, borderRadius: 'var(--radius)', backgroundColor: '#fafafa' }}>
          <label className="toggle">
            <input
              type="checkbox"
              checked={published}
              onChange={handleToggle}
            />
            <span className="toggle-slider" />
          </label>
          <div>
            <div className="toggle-label" style={{ fontSize: 14 }}>
              {published ? '🟢 Published & Active' : '🔴 Offline / Private'}
            </div>
            <div className="text-muted text-sm">
              {published 
                ? 'Your customers can access the menu in real-time.' 
                : 'Turn this on to publish your categories and menu items online.'}
            </div>
          </div>
        </div>
      </div>

      {published && (
        <div className="card text-center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '30px 20px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Restaurant QR Code</h2>
          <p className="text-muted text-sm mb-16">Print this code for tables, takeaway counters, or entrance signage.</p>
          
          <div style={{ padding: 12, border: '1px solid #dee2e6', borderRadius: 12, backgroundColor: 'white', display: 'inline-block', boxShadow: 'var(--shadow)' }}>
            <canvas ref={canvasRef} />
          </div>

          <div className="mt-16" style={{ width: '100%' }}>
            <div className="text-sm text-muted">Public Link</div>
            <a 
              href={publicUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              style={{ fontSize: 14, color: 'var(--primary)', fontWeight: 700, textDecoration: 'underline', wordBreak: 'break-all' }}
            >
              {publicUrl}
            </a>
          </div>

          <button 
            className="btn btn-outline mt-16" 
            onClick={() => {
              const canvas = canvasRef.current;
              if (canvas) {
                const link = document.createElement('a');
                link.download = `qrcode-${slug}.png`;
                link.href = canvas.toDataURL();
                link.click();
              }
            }}
          >
            💾 Download PNG
          </button>
        </div>
      )}
    </div>
  );
}
