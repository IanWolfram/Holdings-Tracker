
import { NextApiRequest, NextApiResponse } from "next";
import { exec } from "child_process";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    console.log("[etrade-trigger] Triggering terminal-based auth script...");
    
    // We run the script in the background. 
    // It will open the browser and start polling the clipboard on the user's Mac.
    exec("npm run eta", (error, stdout, stderr) => {
      if (error) {
        console.error(`[etrade-trigger] Error: ${error.message}`);
        return;
      }
      console.log(`[etrade-trigger] stdout: ${stdout}`);
      console.error(`[etrade-trigger] stderr: ${stderr}`);
    });

    res.status(200).json({ message: "Auth script triggered. Check your browser/terminal." });
  } catch (error) {
    console.error("[etrade-trigger] Failed to trigger script:", error);
    res.status(500).json({ error: "Failed to trigger authentication script" });
  }
}
