import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, ChevronUp, Clipboard, Code2 } from "lucide-react";
import { useCallback, useState } from "react";
import type { SignatureData } from "../types";
import { copyHtmlCode, copyRichText } from "../utils/clipboard";
import { generateSignatureHTML } from "../utils/signatureGenerator";

interface Props {
  data: SignatureData;
}

type CopyState = "idle" | "success" | "error";

function hasContent(data: SignatureData): boolean {
  return Boolean(data.name || data.designation);
}

export default function SignaturePreview({ data }: Props) {
  const [richCopyState, setRichCopyState] = useState<CopyState>("idle");
  const [htmlCopyState, setHtmlCopyState] = useState<CopyState>("idle");
  const [showCode, setShowCode] = useState(false);

  const signatureHTML = hasContent(data) ? generateSignatureHTML(data) : "";

  const handleCopy = useCallback(
    async (type: "rich" | "html") => {
      if (!signatureHTML) return;
      const setter =
        type === "rich" ? setRichCopyState : setHtmlCopyState;
      const ok =
        type === "rich"
          ? await copyRichText(signatureHTML)
          : await copyHtmlCode(signatureHTML);
      setter(ok ? "success" : "error");
      setTimeout(() => setter("idle"), 2500);
    },
    [signatureHTML]
  );

  return (
    <Paper
      component={motion.div}
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, ease: "easeOut", delay: 0.2 }}
      elevation={0}
      sx={{
        p: { xs: 2.5, md: 3.5 },
        borderRadius: 3,
        position: "relative",
        overflow: "hidden",
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "3px",
          background:
            "linear-gradient(90deg, rgba(255,115,0,0.2), #FF7300)",
        },
      }}
    >
      {/* Section header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            bgcolor: "primary.main",
            boxShadow: "0 0 8px rgba(255,115,0,0.8)",
            animation: "pulse 2s ease-in-out infinite 0.5s",
            "@keyframes pulse": {
              "0%, 100%": { opacity: 1, transform: "scale(1)" },
              "50%": { opacity: 0.6, transform: "scale(1.3)" },
            },
          }}
        />
        <Typography variant="h6" sx={{ color: "text.primary" }}>
          Live Preview
        </Typography>
      </Box>

      {/* Email client simulation frame */}
      <Box
        sx={{
          borderRadius: 2,
          overflow: "hidden",
          border: "1px solid #222",
          mb: 2.5,
        }}
      >
        {/* Fake macOS title bar */}
        <Box
          sx={{
            bgcolor: "#1a1a1a",
            px: 2,
            py: 1,
            display: "flex",
            alignItems: "center",
            gap: 1,
            borderBottom: "1px solid #222",
          }}
        >
          {(["#FF5F57", "#FEBC2E", "#28C840"] as const).map((color) => (
            <Box
              key={color}
              sx={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                bgcolor: color,
              }}
            />
          ))}
          <Typography
            variant="caption"
            sx={{
              ml: 1,
              color: "#444",
              fontFamily: "monospace",
              fontSize: "0.7rem",
            }}
          >
            Email Preview
          </Typography>
        </Box>

        {/* Signature on white background */}
        <Box
          sx={{
            bgcolor: "#ffffff",
            p: 3,
            minHeight: 200,
            display: "flex",
            alignItems: hasContent(data) ? "flex-start" : "center",
            justifyContent: hasContent(data) ? "flex-start" : "center",
          }}
        >
          <AnimatePresence mode="wait">
            {hasContent(data) ? (
              <motion.div
                key="signature"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                dangerouslySetInnerHTML={{ __html: signatureHTML }}
              />
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    color: "#aaa",
                    textAlign: "center",
                    fontStyle: "italic",
                  }}
                >
                  Fill in your Name or Designation to see the preview
                </Typography>
              </motion.div>
            )}
          </AnimatePresence>
        </Box>
      </Box>

      {/* Copy buttons */}
      <Box sx={{ display: "flex", gap: 1.5, mb: 2 }}>
        <Tooltip
          title="Paste this directly into Gmail or Outlook signature settings"
          placement="top"
        >
          <span style={{ flex: 1 }}>
            <Button
              variant="contained"
              fullWidth
              disabled={!hasContent(data)}
              onClick={() => handleCopy("rich")}
              startIcon={
                richCopyState === "success" ? (
                  <Check size={16} />
                ) : (
                  <Clipboard size={16} />
                )
              }
              sx={{
                py: 1.4,
                bgcolor:
                  richCopyState === "success"
                    ? "#22c55e"
                    : richCopyState === "error"
                    ? "#ef4444"
                    : "primary.main",
                "&:hover": {
                  bgcolor:
                    richCopyState === "success"
                      ? "#16a34a"
                      : richCopyState === "error"
                      ? "#dc2626"
                      : "primary.dark",
                },
                "&.Mui-disabled": { opacity: 0.4 },
                transition: "background-color 0.3s ease",
              }}
            >
              {richCopyState === "success"
                ? "Copied!"
                : richCopyState === "error"
                ? "Failed — try again"
                : "Copy for Email"}
            </Button>
          </span>
        </Tooltip>

        <Tooltip title="Copy the raw HTML source code" placement="top">
          <span>
            <Button
              variant="outlined"
              disabled={!hasContent(data)}
              onClick={() => handleCopy("html")}
              startIcon={
                htmlCopyState === "success" ? (
                  <Check size={16} />
                ) : (
                  <Code2 size={16} />
                )
              }
              sx={{
                py: 1.4,
                px: 2,
                borderColor:
                  htmlCopyState === "success" ? "#22c55e" : "#2a2a2a",
                color:
                  htmlCopyState === "success"
                    ? "#22c55e"
                    : "text.secondary",
                "&:hover": {
                  borderColor: "primary.main",
                  color: "primary.main",
                },
                "&.Mui-disabled": { opacity: 0.4 },
                transition: "all 0.3s ease",
                whiteSpace: "nowrap",
              }}
            >
              {htmlCopyState === "success" ? "Copied!" : "Copy HTML"}
            </Button>
          </span>
        </Tooltip>
      </Box>

      {/* Usage hint */}
      {hasContent(data) && (
        <Typography
          variant="caption"
          sx={{
            display: "block",
            color: "text.secondary",
            mb: 2,
            textAlign: "center",
          }}
        >
          Use{" "}
          <strong style={{ color: "#FF7300" }}>Copy for Email</strong> →
          paste in Gmail Settings → Signature, or Outlook New Signature
        </Typography>
      )}

      <Divider sx={{ borderColor: "#1e1e1e", mb: 2 }} />

      {/* HTML code toggle */}
      <Button
        size="small"
        variant="text"
        onClick={() => setShowCode((v) => !v)}
        disabled={!hasContent(data)}
        endIcon={showCode ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        sx={{ color: "text.secondary", fontSize: "0.75rem", mb: 1 }}
      >
        {showCode ? "Hide" : "Show"} HTML Source
      </Button>

      <Collapse in={showCode && hasContent(data)}>
        <Box
          sx={{
            bgcolor: "#0d0d0d",
            border: "1px solid #1e1e1e",
            borderRadius: 2,
            p: 2,
            maxHeight: 280,
            overflowY: "auto",
            fontFamily: '"Space Mono", "JetBrains Mono", monospace',
            fontSize: "0.72rem",
            lineHeight: 1.7,
            color: "#00e676",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}
        >
          {signatureHTML}
        </Box>
      </Collapse>
    </Paper>
  );
}
