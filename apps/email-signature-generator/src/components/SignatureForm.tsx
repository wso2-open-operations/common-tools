// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

import Box from "@mui/material/Box";
import InputAdornment from "@mui/material/InputAdornment";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { motion } from "framer-motion";
import {
  Briefcase,
  Linkedin,
  NotebookPen,
  Phone,
  Smartphone,
  User,
} from "lucide-react";
import type { SignatureData } from "../types";

interface Props {
  data: SignatureData;
  onChange: (data: SignatureData) => void;
}

const fields: {
  id: keyof SignatureData;
  label: string;
  icon: React.ReactNode;
  placeholder: string;
  required?: boolean;
  type?: string;
  helper?: string;
}[] = [
  {
    id: "name",
    label: "Full Name",
    icon: <User className="lucide" size={16} />,
    placeholder: "John Anderson",
    required: true,
  },
  {
    id: "designation",
    label: "Designation",
    icon: <Briefcase className="lucide" size={16} />,
    placeholder: "Associate Director / Architect",
    required: true,
  },
  {
    id: "workPhone",
    label: "Work Phone",
    icon: <Phone className="lucide" size={16} />,
    placeholder: "+94 77 555 0001",
    type: "tel",
  },
  {
    id: "personalPhone",
    label: "Mobile Phone",
    icon: <Smartphone className="lucide" size={16} />,
    placeholder: "+94 77 555 0002",
    type: "tel",
  },
  {
    id: "medium",
    label: "Medium URL",
    icon: <NotebookPen className="lucide" size={16} />,
    placeholder: "https://medium.com/@yourusername",
    type: "url",
    helper: "Your Medium profile link",
  },
  {
    id: "linkedin",
    label: "LinkedIn URL",
    icon: <Linkedin className="lucide" size={16} />,
    placeholder: "https://linkedin.com/in/yourusername",
    type: "url",
    helper: "Your LinkedIn profile link",
  },
];

export default function SignatureForm({ data, onChange }: Props) {
  const filled = Object.values(data).filter((v) => v.trim().length > 0).length;
  const total = Object.keys(data).length;

  const handleChange =
    (id: keyof SignatureData) => (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ ...data, [id]: e.target.value });
    };

  return (
    <Paper
      component={motion.div}
      initial={{ opacity: 0, x: -24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
      elevation={0}
      sx={{
        p: { xs: 2.5, md: 3.5 },
        borderRadius: 3,
        border: "0.75px solid #f14e23",
      }}
    >
      {/* Header row */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 3,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              bgcolor: "primary.main",
              boxShadow: "0 0 8px rgba(241,78,35,0.8)",
              animation: "pulse 2s ease-in-out infinite",
              "@keyframes pulse": {
                "0%, 100%": { opacity: 1, transform: "scale(1)" },
                "50%": { opacity: 0.6, transform: "scale(1.3)" },
              },
            }}
          />
          <Typography variant="h6" sx={{ color: "text.primary" }}>
            Your Details
          </Typography>
        </Box>

        {/* Progress dots */}
        <Tooltip title={`${filled} of ${total} fields filled`} placement="left">
          <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
            {Object.keys(data).map((key) => (
              <Box
                key={key}
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  bgcolor: data[key as keyof SignatureData]
                    ? "primary.main"
                    : "#2a2a2a",
                  transition: "background-color 0.3s ease",
                  boxShadow: data[key as keyof SignatureData]
                    ? "0 0 4px rgba(241,78,35,0.5)"
                    : "none",
                }}
              />
            ))}
          </Box>
        </Tooltip>
      </Box>

      {/* Fields grid — full width for name/designation/social; half-width for phones */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
          gap: 2,
        }}
      >
        {fields.map((field, i) => {
          const isWide =
            field.id === "name" ||
            field.id === "designation" ||
            field.id === "medium" ||
            field.id === "linkedin";
          return (
            <Box
              key={field.id}
              component={motion.div}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.06, duration: 0.4 }}
              sx={{ gridColumn: isWide ? { sm: "1 / -1" } : "auto" }}
            >
              <TextField
                id={field.id}
                label={field.label}
                value={data[field.id]}
                onChange={handleChange(field.id)}
                placeholder={field.placeholder}
                type={field.type ?? "text"}
                required={field.required}
                helperText={field.helper}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        {field.icon}
                      </InputAdornment>
                    ),
                  },
                  htmlInput: { autoComplete: "off" },
                }}
              />
            </Box>
          );
        })}
      </Box>

      {/* Required note */}
      <Typography
        variant="caption"
        sx={{ display: "block", mt: 2, color: "text.secondary" }}
      >
        * Name and Designation are required for the signature
      </Typography>

      {/* Progress bar */}
      <Box
        sx={{
          mt: 2.5,
          height: 3,
          borderRadius: 2,
          bgcolor: "#1a1a1a",
          overflow: "hidden",
        }}
      >
        <Box
          component={motion.div}
          animate={{ width: `${(filled / total) * 100}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          sx={{
            height: "100%",
            background: "#f14e23",
            borderRadius: 2,
            boxShadow: "0 0 8px rgba(241,78,35,0.4)",
          }}
        />
      </Box>
      <Typography
        variant="caption"
        sx={{
          display: "block",
          mt: 0.75,
          color: "text.secondary",
          textAlign: "right",
        }}
      >
        {filled}/{total} fields complete
      </Typography>
    </Paper>
  );
}
