import React from 'react';
import ReactMarkdown from 'react-markdown';
import { WithScrollbars } from './ui/WithScrollbars';
import './Changelog.scss';
// @ts-ignore
import ChangelogMD from '../../../CHANGELOG.md';

export const Changelog: React.FC = () => (
  <WithScrollbars>
    <ReactMarkdown className="no-reset changelog">{ChangelogMD}</ReactMarkdown>
  </WithScrollbars>
);
