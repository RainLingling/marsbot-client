import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: "" };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message + "\n" + error.stack };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
    // 写入全局变量方便CDP读取
    (window as any).__appError = error.message + "\n" + (error.stack || "") + "\n" + info.componentStack;
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: "red", fontFamily: "monospace", whiteSpace: "pre-wrap", fontSize: 12 }}>
          <h2>Application Error</h2>
          <pre>{this.state.error}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
