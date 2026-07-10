import { useEffect, useState } from "react";

function Navbar() {
  const [scrollOpacity, setScrollOpacity] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const opacity = Math.min(window.scrollY / 150, 1);
      setScrollOpacity(opacity);
    };

    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const navbarStyle = {
    background: `rgba(10, 12, 35, ${0.05 + scrollOpacity * 0.35})`,
    backdropFilter: `blur(${scrollOpacity * 22}px)`,
    WebkitBackdropFilter: `blur(${scrollOpacity * 22}px)`,
  };

  return (
    <nav style={navbarStyle}>
      <div className="logo">
        Maxim<span>ReconForge</span>
      </div>

      <div className="nav-links">
        <a href="#product">Product</a>
        <a href="#pipeline">Pipeline</a>
        <a href="#docs">Docs</a>
        <a href="#pricing">Pricing</a>
        <a href="#scan" className="nav-btn">
          Start Scan
        </a>
      </div>
    </nav>
  );
}

export default Navbar;