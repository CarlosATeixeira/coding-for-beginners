import { useRef, useState } from "react";
import "./CodeEditorComponent.css";
import TerminalComponent from "./TerminalComponent";
import { runVisualgProgram } from "./visualgInterpreter";

function CodeEditorComponent() {
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const lineNumberRef = useRef<HTMLDivElement>(null);
	const [lineNumbers, setLineNumbers] = useState("1");
	const [terminalLines, setTerminalLines] = useState<string[]>([]);
	const inputResolverRef = useRef<((text: string) => void) | null>(null);

	function ResetTerminal() {
		setTerminalLines([]);
	}

	async function RunCode() {
		if (!textareaRef.current) return;

		ResetTerminal();

		await runVisualgProgram(textareaRef.current.value, (line) =>
			setTerminalLines((prev) => [...prev, line])
		);
	}

	function handleTerminalInput(text: string) {
		if (inputResolverRef.current) {
			inputResolverRef.current(text);
			inputResolverRef.current = null;
		}
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
		if (e.key !== "Tab") return;

		e.preventDefault();

		const textarea = e.currentTarget;
		const { selectionStart, selectionEnd, value } = textarea;

		const getLineStart = (text: string, index: number) =>
			text.lastIndexOf("\n", index - 1) + 1;
		const countLines = (index: number) =>
			(value.slice(0, index).match(/\n/g) || []).length;

		const hasSelection = selectionStart !== selectionEnd;
		const startLine = countLines(selectionStart);
		const endLine = countLines(selectionEnd);
		const lines = value.split("\n");

		if (!e.shiftKey) {
			// ----- TAB -----
			if (!hasSelection) {
				// Nenhuma seleção: insere \t na posição do cursor
				textarea.value =
					value.slice(0, selectionStart) +
					"\t" +
					value.slice(selectionEnd);
				const pos = selectionStart + 1;
				setTimeout(() => {
					textarea.selectionStart = pos;
					textarea.selectionEnd = pos;
				});
				HandleInput();
				return;
			}

			if (startLine === endLine) {
				// Seleção em uma única linha
				lines[startLine] = "\t" + lines[startLine];
				textarea.value = lines.join("\n");
				const posStart = selectionStart + 1;
				const posEnd = selectionEnd + 1;
				setTimeout(() => {
					textarea.selectionStart = posStart;
					textarea.selectionEnd = posEnd;
				});
				HandleInput();
				return;
			}

			// Seleção em múltiplas linhas
			for (let i = startLine; i <= endLine; i++) {
				lines[i] = "\t" + lines[i];
			}
			textarea.value = lines.join("\n");
			const added = endLine - startLine + 1;
			const posStart = selectionStart + 1;
			const posEnd = selectionEnd + added;
			setTimeout(() => {
				textarea.selectionStart = posStart;
				textarea.selectionEnd = posEnd;
			});
			HandleInput();
			return;
		}

		// ----- SHIFT + TAB -----
		if (!hasSelection) {
			const lineStart = getLineStart(value, selectionStart);
			const lineEnd =
				value.indexOf("\n", lineStart) === -1
					? value.length
					: value.indexOf("\n", lineStart);
			const lineText = value.slice(lineStart, lineEnd);

			// Remove TAB vizinho ao cursor na mesma linha
			if (
				selectionStart > lineStart &&
				value[selectionStart - 1] === "\t"
			) {
				textarea.value =
					value.slice(0, selectionStart - 1) +
					value.slice(selectionStart);
				const pos = selectionStart - 1;
				setTimeout(() => {
					textarea.selectionStart = pos;
					textarea.selectionEnd = pos;
				});
				HandleInput();
				return;
			}

			let removed = 0;
			let newLine = lineText;
			if (lineText.startsWith("\t")) {
				newLine = lineText.slice(1);
				removed = 1;
			} else {
				const m = lineText.match(/^\s+/);
				if (m) {
					newLine = lineText.slice(m[0].length);
					removed = m[0].length;
				}
			}

			if (removed > 0) {
				textarea.value =
					value.slice(0, lineStart) + newLine + value.slice(lineEnd);
				const pos = selectionStart - removed;
				setTimeout(() => {
					textarea.selectionStart = pos;
					textarea.selectionEnd = pos;
				});
				HandleInput();
			}
			return;
		}

		if (startLine === endLine) {
			// Seleção em apenas uma linha
			let removed = 0;
			if (lines[startLine].startsWith("\t")) {
				lines[startLine] = lines[startLine].substring(1);
				removed = 1;
			} else {
				const m = lines[startLine].match(/^\s+/);
				if (m) {
					lines[startLine] = lines[startLine].substring(m[0].length);
					removed = m[0].length;
				}
			}

			if (removed > 0) {
				textarea.value = lines.join("\n");
				const posStart = selectionStart - removed;
				const posEnd = selectionEnd - removed;
				setTimeout(() => {
					textarea.selectionStart = posStart;
					textarea.selectionEnd = posEnd;
				});
				HandleInput();
			}
			return;
		}

		// Seleção em múltiplas linhas
		let removeTab = lines
			.slice(startLine, endLine + 1)
			.some((l) => l.startsWith("\t"));
		let totalRemoved = 0;
		let removedFromStartLine = 0;

		if (removeTab) {
			for (let i = startLine; i <= endLine; i++) {
				if (lines[i].startsWith("\t")) {
					lines[i] = lines[i].substring(1);
					totalRemoved += 1;
					if (i === startLine) removedFromStartLine = 1;
				}
			}
		} else {
			for (let i = startLine; i <= endLine; i++) {
				const m = lines[i].match(/^\s+/);
				if (m) {
					lines[i] = lines[i].substring(m[0].length);
					totalRemoved += m[0].length;
					if (i === startLine) removedFromStartLine = m[0].length;
				}
			}
		}

		if (totalRemoved > 0) {
			textarea.value = lines.join("\n");
			const posStart = selectionStart - removedFromStartLine;
			const posEnd = selectionEnd - totalRemoved;
			setTimeout(() => {
				textarea.selectionStart = posStart;
				textarea.selectionEnd = posEnd;
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
			<TerminalComponent
				onRunCode={RunCode}
				lines={terminalLines}
				onInput={handleTerminalInput}
			/>
		</div>
	);
}

export default CodeEditorComponent;
