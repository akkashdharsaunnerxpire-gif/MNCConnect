import React, { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";

const MNCLinearProgress = ({ isLoading }) => {
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef(null);

  useEffect(() => {
    clearTimeout(hideTimer.current);

    if (isLoading) {
      setVisible(true);
    } else {
      hideTimer.current = setTimeout(() => {
        setVisible(false);
      }, 300);
    }

    return () => clearTimeout(hideTimer.current);
  }, [isLoading]);

  if (!visible) return null;

  return (
    <Box
      sx={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        zIndex: 99999,
        pointerEvents: "none",
      }}
    >
      <LinearProgress
        color="primary"
        variant="indeterminate"
        aria-label="Loading..."
        sx={{
          height: "3px",
          backgroundColor: "transparent",
        }}
      />
    </Box>
  );
};

export default MNCLinearProgress;
