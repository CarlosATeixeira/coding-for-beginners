import "./TerminalComponent.css";

interface TerminalProps {
	onRunCode: () => void | Promise<void>;
	lines: string[];
	onInput?: (text: string) => void;
}

function TerminalComponent({ onRunCode, lines, onInput }: TerminalProps) {
	function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
		if (e.key === "Enter" && onInput) {
			const value = e.currentTarget.value;
			e.currentTarget.value = "";
			onInput(value);
		}
	}

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
			<input
				type="text"
				className="terminal-input"
				onKeyDown={handleKeyDown}
			/>
		</div>
	);
}

export default TerminalComponent;
