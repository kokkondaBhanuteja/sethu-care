import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertOctagon } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Button } from "./ui/Button";
import { EmptyState } from "./ui/EmptyState";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Names the boundary in the reported error and in the visible error code, e.g. "booking-detail". */
  boundaryName: string;
  /** Copy is passed in because a class component cannot call useTranslation. */
  title: string;
  body: string;
  retryLabel: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

class ErrorBoundaryInner extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Until an error reporter is wired, the console is the record. console.error rather than
    // console.log so it survives production log filtering.
    console.error(`[${this.props.boundaryName}]`, error, info.componentStack);
  }

  private readonly handleRetry = () => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <EmptyState
        icon={AlertOctagon}
        title={this.props.title}
        body={`${this.props.body} (${this.props.boundaryName}: ${error.message})`}
        grow
        actions={
          <Button variant="outline" size="secondary" block onClick={this.handleRetry}>
            {this.props.retryLabel}
          </Button>
        }
      />
    );
  }
}

export interface RouteErrorBoundaryProps {
  boundaryName: string;
  children: ReactNode;
}

/**
 * The fatal-error state (spec §4.10): full-screen, with the failing boundary named and a way out.
 *
 * Scoped per route rather than wrapped once around the app, so one screen throwing never takes the
 * shell — and therefore the operator's ability to navigate somewhere useful — down with it.
 */
export function RouteErrorBoundary({ boundaryName, children }: RouteErrorBoundaryProps) {
  const { t } = useTranslation("adminShell");

  return (
    <ErrorBoundaryInner
      boundaryName={boundaryName}
      title={t("state.fatalTitle")}
      body={t("state.fatalBody")}
      retryLabel={t("state.retry")}
    >
      {children}
    </ErrorBoundaryInner>
  );
}
