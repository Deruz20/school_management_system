import { PortalPolicyClient } from "./portal-policy-client";

export const metadata = {
  title: "Portal Access Policy | NOVA School Management ERP",
  description: "Configure student and parent portal access rules, Debtor Report Card holds, and outstanding fee thresholds."
};

export default function PortalSettingsPage() {
  return <PortalPolicyClient />;
}
