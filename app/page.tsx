import Landing from "@/components/landing/Landing";

// Public marketing landing. Middleware redirects authenticated users from "/"
// to /terminal, so only unauthenticated visitors reach this.
export default function RootPage() {
  return <Landing />;
}
