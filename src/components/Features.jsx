const features = [
  {
    title: "Subdomain Discovery",
    description:
      "Collect subdomains using multiple recon sources and remove duplicates automatically.",
  },
  {
    title: "Live Host Detection",
    description:
      "Filter dead results and focus only on reachable assets that actually respond.",
  },
  {
    title: "Clean Reports",
    description:
      "Convert raw recon output into readable results for developers, security teams, and audits.",
  },
];

function Features() {
  return (
    <section className="features" id="product">
      {features.map((feature) => (
        <div className="feature-card" key={feature.title}>
          <h3>{feature.title}</h3>
          <p>{feature.description}</p>
        </div>
      ))}
    </section>
  );
}

export default Features;