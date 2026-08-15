export function DeliveryPage() {
  return (
    <main className="naka-delivery-page">
      <section className="naka-delivery-journey">
        <p className="naka-eyebrow">Delivery guide</p>
        <h1>From checkout to your door.</h1>
        <p className="naka-delivery-intro">A simple overview of what happens after an order is placed.</p>
        <div className="naka-delivery-steps">
          <article><span>01</span><h3>Order confirmed</h3><p>We confirm your payment and delivery details.</p></article>
          <article><span>02</span><h3>Prepared</h3><p>Orders placed before 2:30pm enter same-day preparation.</p></article>
          <article><span>03</span><h3>On its way</h3><p>Your tracking details are sent by email after dispatch.</p></article>
        </div>
        <div className="naka-delivery-options">
          <article><p className="naka-eyebrow">Standard · R150</p><h2>3–5 business days</h2><p>Reliable nationwide delivery.</p></article>
          <article><p className="naka-eyebrow">Express · R250</p><h2>1–2 business days</h2><p>Available in selected areas.</p></article>
        </div>
        <div className="naka-delivery-cutoff"><span>Daily order cut-off</span><strong>2:30pm</strong></div>
      </section>
    </main>
  );
}
