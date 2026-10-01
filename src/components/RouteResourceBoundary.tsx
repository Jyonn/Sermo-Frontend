import { Component, type ErrorInfo, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

import { RouteResourceState } from "./RouteResourceState";

interface BoundaryProps {
  children: ReactNode;
  resetKey: string;
  fallback: ReactNode;
}

interface BoundaryState {
  failed: boolean;
  resetKey: string;
}

class RouteResourceErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false, resetKey: this.props.resetKey };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  static getDerivedStateFromProps(props: BoundaryProps, state: BoundaryState) {
    return props.resetKey === state.resetKey ? null : { failed: false, resetKey: props.resetKey };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[sermo:route-resource] load-failed", { error, componentStack: info.componentStack });
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function RouteResourceBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  return (
    <RouteResourceErrorBoundary
      fallback={<RouteResourceState status="error" />}
      resetKey={`${location.pathname}${location.search}`}
    >
      {children}
    </RouteResourceErrorBoundary>
  );
}
