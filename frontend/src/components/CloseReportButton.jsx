import { Link } from 'react-router-dom';

// Closes the report and returns to the main menu (डॅशबोर्ड) - mirrors the
// old desktop app's "बंद करा" button on its Crystal Report viewers
// (Form1.vb btnCloseViewer, Form4.vb, etc.).
export default function CloseReportButton() {
  return <Link className="btn secondary" to="/">बंद करा</Link>;
}
