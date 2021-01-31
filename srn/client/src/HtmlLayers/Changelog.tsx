import React from 'react';
import { WithScrollbars } from './ui/WithScrollbars';
import ReactMarkdown from 'react-markdown';
import "./Changelog.scss"
// @ts-ignore
import ChangelogMD from "../../../CHANGELOG.md"

export const Changelog: React.FC = () => <WithScrollbars>
  <ReactMarkdown className="no-reset changelog">{ChangelogMD}</ReactMarkdown>
</WithScrollbars>;
