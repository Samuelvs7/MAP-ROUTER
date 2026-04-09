import Navbar from './Navbar';
export default function Layout({ children }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />
      <main>{children}</main>
    </div>
  );
}
