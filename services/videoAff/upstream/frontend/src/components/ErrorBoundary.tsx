import { Component, type ReactNode } from "react";

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section className="page" role="alert">
        <h1>Trang này gặp sự cố</h1>
        <p className="muted">Tải lại trang để tiếp tục.</p>
        <button className="btn btn-primary" style={{ alignSelf: "flex-start" }} onClick={() => window.location.reload()}>Tải lại</button>
      </section>
    );
  }
}
