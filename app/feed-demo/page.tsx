import { Suspense } from "react";
import FeedDemo from "./FeedDemo";

export default function FeedDemoPage() {
  return (
    <Suspense fallback={<div style={{ padding: "2rem", fontFamily: "system-ui" }}>Loading feed explorer…</div>}>
      <FeedDemo />
    </Suspense>
  );
}
