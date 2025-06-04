import { useRef, useState } from "react";
import "./CodeEditorComponent.css";
import TerminalComponent from "./TerminalComponent";
import { runVisualgProgram } from "./visualgInterpreter";

function CodeEditorComponent() {
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const lineNumberRef = useRef<HTMLDivElement>(null);
	const [lineNumbers, setLineNumbers] = useState("1");
	const [terminalLines, setTerminalLines] = useState<string[]>([]);

	function RunCode() {
		if (!textareaRef.current) return;

		setTerminalLines([]);

		runVisualgProgram(textareaRef.current.value, (line) =>
			setTerminalLines((prev) => [...prev, line])
		);
	}

	function HandleInput() {
		UpdateLineNumbers();
		UpdateSyntaxHighlight();
	}

	function UpdateLineNumbers() {
		if (!textareaRef.current) return;
		const lines = textareaRef.current.value.split("\n").length;
		setLineNumbers(
			Array.from({ length: lines }, (_, i) => i + 1).join("\n")
		);
	}

	function UpdateSyntaxHighlight() {
		if (!textareaRef.current) return;

		const commentLineString = "//";
		const structureWords = [
			"algoritmo",
			"inicio",
			"fimalgoritmo",
			"var",
			"const",
			"tipo",
		];
		const typeWords = ["inteiro", "real", "caractere", "logico", "literal"];
		const functionsWords = ["leia", "escreva", "escreval"];
		const fluxControlWords = [
			"se",
			"entao",
			"senao",
			"fimse",
			"escolha",
			"caso",
			"outrocaso",
			"fimescolha",
			"enquanto",
			"faca",
			"fimenquanto",
			"para",
			"de",
			"ate",
			"passo",
			"fimpara",
			"repita",
			"fimrepita",
			"interrompa",
			"retorne",
		];

		const text = textareaRef.current.value;

		const escaped = text
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;");

		const structureRegex = new RegExp(
			`\\b(${structureWords.join("|")})\\b`,
			"gi"
		);
		const typeRegex = new RegExp(`\\b(${typeWords.join("|")})\\b`, "g");
		const functionRegex = new RegExp(
			`\\b(${functionsWords.join("|")})\\b`,
			"gi"
		);
		const fluxRegex = new RegExp(
			`\\b(${fluxControlWords.join("|")})\\b`,
			"gi"
		);

		const stringRegex = /(["'])(?:(?!\1|\\).|\\.)*\1/g;

		const lines = escaped.split("\n");

		const highlightedLines = lines.map((line) => {
			let commentIndex = line.indexOf(commentLineString);

			const stringMap: string[] = [];
			let stringPlaceholderIndex = 0;

			const lineWithPlaceholders = line.replace(stringRegex, (match) => {
				const key = `__STRING_PLACEHOLDER_${stringPlaceholderIndex}__`;
				stringMap.push(match);
				stringPlaceholderIndex++;
				return key;
			});

			function DoReplaces(s: string) {
				return s
					.replace(
						structureRegex,
						`<span class="highlight-structure">$1</span>`
					)
					.replace(
						typeRegex,
						`<span class="highlight-type">$1</span>`
					)
					.replace(
						functionRegex,
						`<span class="highlight-function">$1</span>`
					)
					.replace(
						fluxRegex,
						`<span class="highlight-flux">$1</span>`
					);
			}

			let codePart = lineWithPlaceholders;
			let commentPart = "";

			if (commentIndex >= 0) {
				const recomputedIndex = codePart.indexOf(commentLineString);
				if (recomputedIndex >= 0) {
					codePart = lineWithPlaceholders.slice(0, recomputedIndex);
					commentPart = lineWithPlaceholders.slice(recomputedIndex);
				}
			}

			let result = DoReplaces(codePart);

			stringMap.forEach((original, i) => {
				const safe = `<span class="highlight-string">${original}</span>`;
				result = result.replace(`__STRING_PLACEHOLDER_${i}__`, safe);
			});

			if (commentPart)
				result += `<span class="highlight-comment">${commentPart}</span>`;

			return result;
		});

		const highlightLayer = textareaRef.current
			.previousElementSibling as HTMLPreElement;
		if (highlightLayer)
			highlightLayer.innerHTML = highlightedLines.join("\n") + "\n";
	}

	function HandleScroll(e: React.UIEvent<HTMLTextAreaElement>) {
		const scrollTop = e.currentTarget.scrollTop;
		const scrollLeft = e.currentTarget.scrollLeft;

		const highlight = e.currentTarget
			.previousElementSibling as HTMLPreElement;

		if (highlight) {
			highlight.scrollTop = scrollTop;
			highlight.scrollLeft = scrollLeft;
		}

		if (lineNumberRef.current) {
			lineNumberRef.current.scrollTop = scrollTop;
		}
	}

	function HandleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
		if (e.key === "Tab") {
			e.preventDefault();

			const textarea = e.currentTarget;
			const { selectionStart, selectionEnd, value } = textarea;

			const lines = value.split("\n");

			// Calcula o índice das linhas afetadas
			let start = selectionStart;
			let end = selectionEnd;

			let charCount = 0;
			let startLine = 0;
			let endLine = 0;

			for (let i = 0; i < lines.length; i++) {
				const lineLength = lines[i].length + 1; // +1 por '\n'
				if (charCount + lineLength > start && startLine === 0) {
					startLine = i;
				}
				if (charCount + lineLength >= end) {
					endLine = i;
					break;
				}
				charCount += lineLength;
			}

			let offset = 0;

			for (let i = startLine; i <= endLine; i++) {
				if (e.shiftKey) {
					// SHIFT+TAB: Remove 1 tab ou 4 espaços no início
					if (lines[i].startsWith("\t")) {
						lines[i] = lines[i].substring(1);
						if (i === startLine) offset -= 1;
					} else if (lines[i].startsWith("    ")) {
						lines[i] = lines[i].substring(4);
						if (i === startLine) offset -= 4;
					}
				} else {
					// TAB: Adiciona \t no início
					lines[i] = "\t" + lines[i];
					if (i === startLine) offset += 1;
				}
			}

			const newValue = lines.join("\n");
			textarea.value = newValue;

			setTimeout(() => {
				textarea.selectionStart = selectionStart + offset;
				textarea.selectionEnd = selectionEnd + offset;
			});

			HandleInput();
		}
	}

	return (
		<div className="page-wrapper">
			<div className="editor-wrapper">
				<div ref={lineNumberRef} className="line-numbers">
					{lineNumbers}
				</div>
				<div className="editor-container">
					<pre className="highlight-layer" aria-hidden="true"></pre>
					<textarea
						spellCheck={false}
						ref={textareaRef}
						className="code-input"
						onInput={HandleInput}
						onScroll={HandleScroll}
						onKeyDown={HandleKeyDown}
					/>
				</div>
			</div>
			<TerminalComponent onRunCode={RunCode} lines={terminalLines} />
		</div>
	);
}

export default CodeEditorComponent;
