import React, { useRef } from "react";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import { X } from "lucide-react";

/**
 * <FormAlert open={Boolean(error)} severity="error" title="Login failed" onClose={() => setError("")}>
 *   {error}
 * </FormAlert>
 * severity: "error" | "success" | "warning" | "info"
 */
export default function FormAlert({
  open,
  severity = "error",
  title,
  onClose,
  children,
}) {
  // keep the last content so the text does not vanish during the close animation
  const last = useRef({ severity, title, children });
  if (open) last.current = { severity, title, children };
  const c = last.current;

  return (
    <Collapse in={Boolean(open)} unmountOnExit>
      <Box sx={{ pb: 2.5 }}>
        <Alert
          severity={c.severity}
          sx={{ borderRadius: "16px", alignItems: "flex-start", fontSize: 13 }}
          action={
            onClose ? (
              <IconButton
                aria-label="close"
                color="inherit"
                size="small"
                onClick={onClose}
              >
                <X size={16} />
              </IconButton>
            ) : undefined
          }
        >
          {c.title && <AlertTitle sx={{ fontWeight: 700 }}>{c.title}</AlertTitle>}
          {c.children}
        </Alert>
      </Box>
    </Collapse>
  );
}