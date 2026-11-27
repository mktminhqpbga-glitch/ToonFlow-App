import { useSearchParams } from "react-router-dom";
import { PageHead } from "../components/ui";
import { RulesTab } from "./memory/RulesTab";
import { ScenesTab } from "./memory/ScenesTab";

type Tab = "rules" | "scenes";

export function MemoryPage() {
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get("tab") === "scenes" ? "scenes" : "rules";
  return (
    <div className="page">
      <PageHead title="Bộ nhớ AI" text="Quản lý quy tắc và ảnh tham khảo AI dùng cho các video tiếp theo." />
      <div className="tabs" role="tablist" aria-label="Bộ nhớ AI">
        <button role="tab" aria-selected={tab === "rules"} onClick={() => setParams({})}>Quy tắc</button>
        <button role="tab" aria-selected={tab === "scenes"} onClick={() => setParams({ tab: "scenes" })}>Ảnh bối cảnh</button>
      </div>
      {tab === "rules" ? <RulesTab /> : <ScenesTab />}
    </div>
  );
}
