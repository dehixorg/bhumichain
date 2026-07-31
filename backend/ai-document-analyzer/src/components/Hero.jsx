import './Hero.css';

export default function Hero() {
  return (
    <header className="hero">
      <div className="hero-badge">
        <span className="dot" />
        Powered by Azure OpenAI GPT-5.4
      </div>
      <h1>Legal Document Analyzer</h1>
      <p>
        Upload a property-related legal document (deed, mortgage, lease, title
        report, easement, or lien) and extract structured data instantly with AI.
      </p>
    </header>
  );
}
