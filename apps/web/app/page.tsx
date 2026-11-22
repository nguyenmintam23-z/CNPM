import CustomerHome from "./CustomerHome";
import CustomerHomeRoleGate from "../components/auth/CustomerHomeRoleGate";
export default function HomePage() {
  return (
    <CustomerHomeRoleGate>
      <CustomerHome />
    </CustomerHomeRoleGate>
  );
}
