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

import React, { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

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
    <div className="h-full transition-colors duration-200">
      {/* Tab Navigation */}
      <Tabs
        tabs={tabsPage}
        activeIndex={value}
        handleTabClick={handleTabClick}
      />

      {/* Tab Content with animations */}
      <AnimatePresence mode="wait">
        {tabsPage.map(
          (tab, index) =>
            value === index && (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="w-full"
              >
                <TabPanel value={value} index={index}>
                  {tab.page}
                </TabPanel>
              </motion.div>
            )
        )}
      </AnimatePresence>
    </div>
  );
}

interface TabToggleProps {
  tabs: TabProps[];
  activeIndex: number;
  handleTabClick: (index: number) => void;
}

export function Tabs({ tabs, activeIndex, handleTabClick }: TabToggleProps) {
  return (
    <div className="flex flex-row">
      <div className="flex border-b border-st-border-medium  w-full relative hover:text-gray-700 transition-colors duration-200 ">
        {tabs.map((tab, index) => (
          <motion.button
            key={index}
            onClick={() => handleTabClick(index)}
            className={`
                flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium relative
                ${activeIndex === index ? "text-st-text-100 " : "text-gray-500"}
              `}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="w-fit items-center">
              {React.cloneElement(tab.icon, {
                className: `w-5 h-5 mb-[2px]  ${
                  activeIndex === index ? "text-st-text-100" : "text-gray-500 "
                }`,
              })}
            </span>
            <span>{tab.tabTitle}</span>

            {/* Animated underline */}
            {activeIndex === index && (
              <motion.div
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-st-text-100"
                layoutId="activeTab"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
              />
            )}
          </motion.button>
        ))}
      </div>
    </div>
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
    <div
      role="tabpanel"
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
      className="p-4"
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
      >
        {children}
      </motion.div>
    </div>
  );
}
