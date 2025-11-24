// Copyright (c) 2025 WSO2 LLC. (https://www.wso2.com).
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
import { Box, Button, useTheme } from "@mui/material";
import { AnimatePresence, motion } from "framer-motion";
import { useSearchParams } from "react-router-dom";

import React, { useEffect, useMemo, useState } from "react";

interface TabsPageProps {
  title: string;
  tabsPage: TabProps[];
}

interface TabProps {
  tabTitle: string;
  tabPath: string;
  icon: React.ReactElement<any, string | React.JSXElementConstructor<any>>;
  page: React.ReactElement<any, string | React.JSXElementConstructor<any>>;
}

export default function TabsPage({ tabsPage }: TabsPageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [value, setValue] = useState<number>(0);

  const tabs = useMemo(() => tabsPage.map((tab) => tab.tabPath), [tabsPage]);

  useEffect(() => {
    const currentTab = searchParams.get("tab");
    const tabIndex = currentTab ? tabs.indexOf(currentTab) : -1;

    if (tabIndex !== -1) {
      setValue(tabIndex);
    } else {
      setValue(0);
      setSearchParams({ tab: tabs[0] }, { replace: true });
    }
  }, [searchParams, tabs, setSearchParams]);

  const handleTabClick = (index: number) => {
    setValue(index);
    setSearchParams({ tab: tabs[index] });
  };

  return (
    <Box
      sx={{
        height: "100%",
        transition: "color 200ms",
      }}
    >
      {/* Tab Navigation */}
      <Tabs tabs={tabsPage} activeIndex={value} handleTabClick={handleTabClick} />

      {/* Tab Content with animations */}
      <AnimatePresence mode="wait">
        {tabsPage.map(
          (tab, index) =>
            value === index && (
              <Box
                component={motion.div}
                key={index}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                sx={{ width: "100%" }}
              >
                <TabPanel value={value} index={index}>
                  {tab.page}
                </TabPanel>
              </Box>
            ),
        )}
      </AnimatePresence>
    </Box>
  );
}

interface TabToggleProps {
  tabs: TabProps[];
  activeIndex: number;
  handleTabClick: (index: number) => void;
}

export function Tabs({ tabs, activeIndex, handleTabClick }: TabToggleProps) {
  const theme = useTheme();

  return (
    <Box sx={{ display: "flex", flexDirection: "row" }}>
      <Box
        sx={{
          display: "flex",
          borderBottom: 1,
          borderColor: theme.palette.customBorder.territory.active,
          width: "100%",
          position: "relative",
          transition: "color 200ms",
        }}
      >
        {tabs.map((tab, index) => (
          <Button
            component={motion.button}
            key={index}
            onClick={() => handleTabClick(index)}
            disableRipple
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              paddingTop: "8px",
              paddingBottom: "16px",
              borderRadius: "0px",
              px: 2,
              fontSize: "0.875rem",
              fontWeight: "medium",
              position: "relative",
              color:
                activeIndex === index
                  ? theme.palette.customText.primary.p2.active
                  : theme.palette.customText.primary.p3.active,
              textTransform: "none",
              minWidth: "auto",
              borderBottom:
                activeIndex === index
                  ? `2px solid ${theme.palette.customText.primary.p2.active}`
                  : "none",
              "&:hover": {
                backgroundColor: "transparent",
              },
            }}
          >
            <Box
              component="span"
              sx={{ width: "fit-content", display: "flex", alignItems: "center" }}
            >
              {React.cloneElement(tab.icon)}
            </Box>
            <Box component="span">{tab.tabTitle}</Box>

          </Button>
        ))}
      </Box>
    </Box>
  );
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

export function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <Box
      role="tabpanel"
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
      sx={{ p: 4 }}
    >
      <Box
        component={motion.div}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
      >
        {children}
      </Box>
    </Box>
  );
}
