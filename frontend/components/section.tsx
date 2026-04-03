import type { ReactNode } from "react";

type SectionProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function Section({ title, subtitle, actions, children }: SectionProps) {
  return (
    <section className="panel section">
      <div className="section-header">
        <div>
          <h2 className="section-title">{title}</h2>
          {subtitle ? <p className="section-subtitle">{subtitle}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
