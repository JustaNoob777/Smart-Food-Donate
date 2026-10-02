import PublicHeader from "@/components/PublicHeader";
import { motion } from "framer-motion";
import { ArrowLeft, Search } from "lucide-react";
import { useNavigate } from "react-router";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="flex min-h-screen flex-col"
    >
      <PublicHeader />

      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="clay relative w-full max-w-md overflow-hidden px-8 py-12 text-center">
          <span className="clay-tile-amber absolute -top-6 -right-4 grid size-16 place-items-center rounded-full text-2xl shadow-lg">
            🍽️
          </span>
          <span className="clay-tile-sage absolute -bottom-5 -left-4 grid size-14 place-items-center rounded-full text-xl shadow-lg">
            🥖
          </span>

          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#f4ede2] shadow-inner">
            <Search className="size-6 text-muted-foreground" />
          </div>
          <h1 className="mt-5 text-5xl font-extrabold tracking-tight">404</h1>
          <p className="mt-2 font-bold">This page isn&apos;t on the route.</p>
          <p className="mx-auto mt-1 max-w-xs text-sm leading-6 text-muted-foreground">
            The linked list of pages doesn&apos;t contain this node — head back and
            try the next one.
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button className="clay-btn px-5 py-2.5 text-sm font-extrabold" onClick={() => navigate("/")}>
              <ArrowLeft className="mr-1 inline size-4" />
              Back home
            </button>
            <button
              className="clay-btn-ghost px-5 py-2.5 text-sm font-extrabold"
              onClick={() => navigate("/dashboard")}
            >
              Dashboard
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
