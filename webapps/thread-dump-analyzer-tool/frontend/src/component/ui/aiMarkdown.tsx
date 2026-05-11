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

import React from 'react';
import { Box, List, ListItem, ListItemIcon, Typography } from '@mui/material';

// Matches Thread-N and multi-segment hyphenated identifiers like http-nio-8080-exec-5
const THREAD_RE_SOURCE = String.raw`\b(Thread-\d+|[A-Za-z][\w]*(?:-[\w]+){2,}-\d+)\b`;

export type ParsedBlock =
    | { type: 'bullets'; items: string[] }
    | { type: 'ordered'; items: string[] }
    | { type: 'paragraph'; text: string; hasBold: boolean };

// Renders **bold** markers and thread-name-like tokens as inline styled spans.
// Pass onThreadClick to make thread badges interactive (navigates to thread explorer).
export function renderInline(text: string, onThreadClick?: (name: string) => void): React.ReactNode {
    const boldParts = text.split(/\*\*([^*]+)\*\*/);
    return (
        <React.Fragment>
            {boldParts.map((part, i) => {
                if (i % 2 === 1) return <strong key={i}>{part}</strong>;
                const threadParts = part.split(new RegExp(THREAD_RE_SOURCE, 'g'));
                if (threadParts.length === 1) return part || null;
                return (
                    <React.Fragment key={i}>
                        {threadParts.map((tp, j) =>
                            j % 2 === 1 ? (
                                <Box
                                    key={j}
                                    component="span"
                                    onClick={onThreadClick ? (e: React.MouseEvent) => { e.stopPropagation(); onThreadClick(tp); } : undefined}
                                    sx={(theme) => ({
                                        fontFamily: 'monospace',
                                        fontSize: '0.68em',
                                        px: 0.6,
                                        py: 0.1,
                                        mx: 0.3,
                                        borderRadius: '3px',
                                        bgcolor: theme.palette.surface.codeBg,
                                        border: `1px solid ${theme.palette.surface.codeBorder}`,
                                        color: theme.palette.surface.codeText,
                                        display: 'inline-block',
                                        verticalAlign: 'middle',
                                        whiteSpace: 'nowrap',
                                        lineHeight: 1.5,
                                        cursor: onThreadClick ? 'pointer' : 'text',
                                        transition: 'border-color 0.15s, opacity 0.15s',
                                        ...(onThreadClick && {
                                            '&:hover': {
                                                borderColor: theme.palette.brand.main,
                                                opacity: 0.85,
                                            },
                                        }),
                                    })}
                                >
                                    {tp}
                                </Box>
                            ) : (tp || null)
                        )}
                    </React.Fragment>
                );
            })}
        </React.Fragment>
    );
}

// Strips all markdown heading markers (##, ###, etc.) — including standalone ones with no
// following text — before line splitting so they never reach the renderer as literal characters.
function sanitize(raw: string): string {
    return raw
        // leading hashes on any line
        .replace(/^[ 	]*#{1,6}[ 	]*/gm, '')  
        // any remaining stray hash sequences
        .replace(/#{1,6}/g, '');                 
}

// Splits raw AI text into typed blocks: headings, bullet lists, ordered lists, paragraphs.
export function parseBlocks(raw: string): ParsedBlock[] {
    const lines = sanitize(raw).split('\n').map(l => l.trim()).filter(Boolean);
    const blocks: ParsedBlock[] = [];
    let bulletBuf: string[] = [];
    let orderedBuf: string[] = [];

    const flushBullets = () => {
        if (bulletBuf.length) { blocks.push({ type: 'bullets', items: [...bulletBuf] }); bulletBuf = []; }
    };
    const flushOrdered = () => {
        if (orderedBuf.length) { blocks.push({ type: 'ordered', items: [...orderedBuf] }); orderedBuf = []; }
    };

    for (const line of lines) {
        if (/^[*\-]\s/.test(line)) {
            flushOrdered();
            bulletBuf.push(line.replace(/^[*\-]\s+/, ''));
        } else if (/^\d+[.)]\s/.test(line)) {
            flushBullets();
            orderedBuf.push(line.replace(/^\d+[.)]\s+/, ''));
        } else {
            flushBullets(); flushOrdered();
            blocks.push({ type: 'paragraph', text: line, hasBold: /\*\*/.test(line) });
        }
    }
    flushBullets(); flushOrdered();
    return blocks;
}

export interface RenderBlocksOptions {
    // Icon rendered before every list item (use same node for all items).
    listIcon?: React.ReactNode;
    // Wrap paragraphs that contain **bold** in a subtle brand-tinted highlight box.
    highlightBoldParagraphs?: boolean;
    // Give the first paragraph block stronger text weight to act as a lead sentence.
    emphasizeFirstParagraph?: boolean;
    // When provided, thread-name badges become clickable and navigate to the thread explorer.
    onThreadClick?: (name: string) => void;
}

export function renderBlocks(blocks: ParsedBlock[], options: RenderBlocksOptions = {}): React.ReactNode {
    const { listIcon, highlightBoldParagraphs = false, emphasizeFirstParagraph = false, onThreadClick } = options;
    let firstParaSeen = false;

    return (
        <>
            {blocks.map((block, i) => {
                if (block.type === 'bullets' || block.type === 'ordered') {
                    return (
                        <List key={i} dense disablePadding sx={{ mb: 0.5 }}>
                            {block.items.map((item, j) => (
                                <ListItem key={j} alignItems="flex-start" disableGutters sx={{ py: 0.3 }}>
                                    {listIcon && (
                                        <ListItemIcon sx={{ minWidth: 22, mt: '2px', flexShrink: 0 }}>
                                            {listIcon}
                                        </ListItemIcon>
                                    )}
                                    <Typography
                                        variant="caption"
                                        component="span"
                                        color="text.secondary"
                                        sx={{ lineHeight: 1.75 }}
                                    >
                                        {renderInline(item, onThreadClick)}
                                    </Typography>
                                </ListItem>
                            ))}
                        </List>
                    );
                }

                // Paragraph
                const isFirst = emphasizeFirstParagraph && !firstParaSeen;
                const isHighlighted = highlightBoldParagraphs && block.hasBold;
                if (!firstParaSeen) firstParaSeen = true;

                if (isHighlighted) {
                    return (
                        <Box
                            key={i}
                            sx={(theme) => ({
                                borderLeft: `2px solid ${theme.palette.brand.softBorder}`,
                                pl: 1.5,
                                py: 0.5,
                                mb: 1,
                                borderRadius: '0 4px 4px 0',
                                bgcolor: theme.palette.brand.softBg,
                            })}
                        >
                            <Typography
                                variant="caption"
                                component="span"
                                sx={{ lineHeight: 1.75, fontWeight: 500, color: 'text.primary', display: 'block' }}
                            >
                                {renderInline(block.text, onThreadClick)}
                            </Typography>
                        </Box>
                    );
                }

                return (
                    <Typography
                        key={i}
                        variant="caption"
                        display="block"
                        sx={{
                            lineHeight: 1.75,
                            mb: 0.75,
                            color: isFirst ? 'text.primary' : 'text.secondary',
                            fontWeight: isFirst ? 500 : 400,
                        }}
                    >
                        {renderInline(block.text, onThreadClick)}
                    </Typography>
                );
            })}
        </>
    );
}
