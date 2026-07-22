import { useEffect } from "react";
import { useSession } from "@sethu/core";

import { AppRoutes } from "./routes/AppRoutes";

/**
 * The root component. Deliberately thin: it restores the persisted session and hands off to the
 * route table. Shell selection, guards and layout all live under routes/ and layouts/.
 */
export default function App() {
  const hydrate = useSession((state) => state.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return <AppRoutes />;
}
