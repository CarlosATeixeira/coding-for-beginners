interface TerminalProps {
	onRunCode: () => void;
	lines: string[];
}

function TerminalComponent({ onRunCode, lines }: TerminalProps) {
	return (
		<div className="terminal">
			<div className="terminal-header">
				Terminal
				<button onClick={onRunCode} style={{ float: "right" }}>
					Run ▶
				</button>
			</div>
			<div className="terminal-content">
				{lines.map((line, i) => (
					<div key={i}>{line}</div>
				))}
			</div>
		</div>
	);
}

export default TerminalComponent;
