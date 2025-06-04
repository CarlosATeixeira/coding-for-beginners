// visualgInterpreter.ts

/**
 * INTERPRETADOR COMPLETO DO VISUALG 3.0 EM TYPE SCRIPT
 *
 * Cobertura de:
 *  - Palavras‐chave (algoritmo, inicio, var, inteiro, real, logico, caractere, literal, const, funcao, fimfuncao etc.)
 *  - Tipos básicos (inteiro, real, lógico, caractere, literal/string)
 *  - Declarações de variável e constante
 *  - Laços: PARA ... FIMPARA, ENQUANTO ... FIMENQUANTO, REPITA ... ATE
 *  - Desvios condicionais: SE ... SENAO ... FIMSE, ESCOLHA ... CASO ... OUTROCASO ... FIMESCOLHA
 *  - Comandos I/O: ESCREVA, ESCREVAL, LEIA
 *  - Funções matemáticas pré‐definidas (Abs, Log, Sen, Cos, Tan, Exp, Pot, Quad, Cotan, ArcSen, ArcCos, Raizq, Rand, Randi, Div, Mod etc.)
 *  - Funções de conversão (Pos, Asc, Carac, Copia, Int, Compr, Maiusc, Minusc, NumpCarac, CaracPNum)
 *  - Comandos de console “extras” (LimpaTela, Pausa) – mapeados para consola.
 *  - UDFs (FUNCAO / FIMFUNCAO e PROCEDIMENTO / FIMPROCEDIMENTO) – escopo local de variáveis, pilha básica de chamadas.
 *  - Parâmetros por valor em funções / procedimentos e retorno em funções.
 *  - Comando INTERROMPA e RETORNE.
 *
 * **OBSERVAÇÕES GERAIS**:
 * - Não há suporte a arrays ou registros complexos (somente variáveis escalares).
 * - Strings literais (LITERAL) são delimitadas por aspas duplas; caracteres (CARACTERE) podem ser usados como string de um caractere.
 * - Os nomes de variáveis / funções são case‐insensitive internamente, mas preservamos a forma original.
 * - O interpretador trata comentários de linha (// …) e ignora tudo após “//” até o fim da linha.
 * - O suporte a MudaCor, Timer, Debug, Cronometro, etc. está esboçado – implementado como stub (sem alteração real de cor ou tempo).
 * - O interpretador mapeia LimpaTela para “console.clear()” e Pausa para aguardar pressionamento de tecla (por enquanto, só exibe uma mensagem e retorna imediatamente).
 * - Interrompa (equivalente a “break” em laços) e Retorne (em funções) estão contemplados.
 * - A linguagem aceita somente palavras‐chave sem acentuação (ENTAO, SENAO etc.). Se for preciso suportar acentuado, basta adicionar as variantes no mapa de keywords.
 * - Todo comentário “//” é armazenado e impresso em ESCREVAL, mas não afeta a execução.
 */

///////////////////////
// 1) DEFINIÇÃO DE TOKENS
///////////////////////

/**
 * Cada token é um objeto que carrega:
 *  - type: o tipo sintático (identificador, palavra-chave, número, operador etc.)
 *  - lexeme: a string original extraída
 *  - literal: valor numérico ou string, quando aplicável (para literais)
 *  - line: número da linha original (para mensagens de erro)
 */
enum TokenType {
	// DELIMITADORES
	LEFT_PAREN, RIGHT_PAREN,       // ( )
	COMMA, SEMICOLON,               // , ;
	COLON,                          // :
	DOT,                            // .
  
	// OPERADORES ARITMÉTICOS
	PLUS, MINUS, STAR, SLASH, PERCENT, // + - * / %
  
	// OPERADORES RELACIONAIS
	BANG, BANG_EQUAL,        // !  !=
	EQUAL, EQUAL_EQUAL,      // =  ==
	GREATER, GREATER_EQUAL,  // >  >=
	LESS, LESS_EQUAL,        // <  <=
  
	// OPERADORES LÓGICOS (palavras)
	AND, OR, NOT, XOR,
  
	// LITERALS
	IDENTIFIER, STRING, NUMBER,
  
	// PALAVRAS‐CHAVE DO VISUALG (case‐insensitive)
	ALGORITMO, VAR, CONST, INICIO, FIMALGORITMO,
	TIPO, PROCEDIMENTO, FIMPROCEDIMENTO,
	FUNCAO, FIMFUNCAO,
	PARA, FIMPARA, DE, ATE, PASSO, FACA,
	ENQUANTO, FIMENQUANTO,
	REPITA, ATECOMANDO, // “REPITA ... ATE”
	ESCOLHA, CASO, OUTROCASO, FIMESCOLHA,
	SE, ENTAO, SENAO, FIMSE,
	RETORNE, INTERROMPA,
	PAUSA, LIMITELA,        // “pausa” e “limpatela”
	ESCREVA, ESCREVAL, LEIA,
  
	// TIPOS DE DADOS
	INTEIRO, REAL, LOGICO, CARACTERE, LITERAL,
  
	// FUNÇÕES E CONSTANTES
	ABS, LOG, SEN, COS, TAN, EXP, POT, QUAD, COTAN, ARCSEN, ARCCOS, RAIZQ,
	RAND, RANDI, DIV, MOD,
	POS, ASC, CARAC, COPIA, INT, COMPR, MAIUSC, MINUSC, NUMPCARAC, CARACPNUM,
	MUDA_COR,
	VERDADEIRO, FALSO,
  
	EOF
  }
  
  /**
   * Estrutura básica de um token lido pelo lexer.
   */
  class Token {
	type: TokenType;
	lexeme: string;
	literal: any;
	line: number;
  
	constructor(type: TokenType, lexeme: string, literal: any, line: number) {
	  this.type = type;       // Tipo do token (enum TokenType)
	  this.lexeme = lexeme;   // String original (ex.: "algoritmo", "x", "123", "\"Olá\"")
	  this.literal = literal; // Valor para literais (ex.: número float, string sem aspas)
	  this.line = line;       // Linha no código fonte (para relatório de erro)
	}
  
	toString() {
	  return `[${TokenType[this.type]}] ${this.lexeme} ${this.literal}`;
	}
  }
  
  ///////////////////////
  // 2) LEXER (TOKENIZADOR)
  ///////////////////////
  
  /**
   * O Lexer percorre cada caractere da entrada e gera tokens em sequência.
   * Ele ignora espaços, tabulações e comentários de linha (“//...”), mas preserva
   * o número da linha para erros.
   */
  class Lexer {
	private source: string;      // Texto completo do programa
	private tokens: Token[] = []; // Tokens gerados
	private start: number = 0;     // Índice inicial do lexema atual
	private current: number = 0;   // Índice atual sendo analisado
	private line: number = 1;      // Número da linha atual
	private keywords: Record<string, TokenType>;
  
	constructor(source: string) {
	  this.source = source;
  
	  // Mapeamento de strings (em caixa‐baixa) para TokenType de palavras‐chave
	  this.keywords = {
		"algoritmo": TokenType.ALGORITMO,
		"var": TokenType.VAR,
		"const": TokenType.CONST,
		"inicio": TokenType.INICIO,
		"fimalgoritmo": TokenType.FIMALGORITMO,
		"tipo": TokenType.TIPO,
		"procedimento": TokenType.PROCEDIMENTO,
		"fimprocedimento": TokenType.FIMPROCEDIMENTO,
		"funcao": TokenType.FUNCAO,
		"fimfuncao": TokenType.FIMFUNCAO,
		"para": TokenType.PARA,
		"fimpara": TokenType.FIMPARA,
		"de": TokenType.DE,
		"ate": TokenType.ATE,
		"passo": TokenType.PASSO,
		"faca": TokenType.FACA,
		"enquanto": TokenType.ENQUANTO,
		"fimenquanto": TokenType.FIMENQUANTO,
		"repita": TokenType.REPITA,
		"atecomando": TokenType.ATECOMANDO,
		"escolha": TokenType.ESCOLHA,
		"caso": TokenType.CASO,
		"outrocaso": TokenType.OUTROCASO,
		"fimescolha": TokenType.FIMESCOLHA,
		"se": TokenType.SE,
		"entao": TokenType.ENTAO,
		"senao": TokenType.SENAO,
		"fimse": TokenType.FIMSE,
		"retorne": TokenType.RETORNE,
		"interrompa": TokenType.INTERROMPA,
		"pausa": TokenType.PAUSA,
		"limpatela": TokenType.LIMITELA,    // removida duplicidade
		"escreva": TokenType.ESCREVA,
		"escreval": TokenType.ESCREVAL,
		"leia": TokenType.LEIA,
		"inteiro": TokenType.INTEIRO,
		"real": TokenType.REAL,
		"logico": TokenType.LOGICO,
		"caractere": TokenType.CARACTERE,
		"literal": TokenType.LITERAL,
		"abs": TokenType.ABS,
		"log": TokenType.LOG,
		"sen": TokenType.SEN,
		"cos": TokenType.COS,
		"tan": TokenType.TAN,
		"exp": TokenType.EXP,
		"pot": TokenType.POT,
		"quad": TokenType.QUAD,
		"cotan": TokenType.COTAN,
		"arcsen": TokenType.ARCSEN,
		"arccos": TokenType.ARCCOS,
		"raizq": TokenType.RAIZQ,
		"rand": TokenType.RAND,
		"randi": TokenType.RANDI,
		"div": TokenType.DIV,
		"mod": TokenType.MOD,
		"pos": TokenType.POS,
		"asc": TokenType.ASC,
		"carac": TokenType.CARAC,
		"copia": TokenType.COPIA,
		"int": TokenType.INT,
		"compr": TokenType.COMPR,
		"maiusc": TokenType.MAIUSC,
		"minusc": TokenType.MINUSC,
		"numpcarac": TokenType.NUMPCARAC,
		"caracpnum": TokenType.CARACPNUM,
		"mudacor": TokenType.MUDA_COR,
		"verdadeiro": TokenType.VERDADEIRO,
		"falso": TokenType.FALSO,
		"e": TokenType.AND,
		"ou": TokenType.OR,
		"nao": TokenType.NOT,
		"xor": TokenType.XOR
	  };
	}
  
	/**
	 * Função principal: escaneia toda a fonte e retorna a lista de tokens.
	 */
	scanTokens(): Token[] {
	  // Enquanto não chegarmos ao fim da string...
	  while (!this.isAtEnd()) {
		this.start = this.current;
		this.scanToken(); // consome um token
	  }
  
	  // Ao final, adiciona um token EOF para sinalizar o fim
	  this.tokens.push(new Token(TokenType.EOF, "", null, this.line));
	  return this.tokens;
	}
  
	/**
	 * Retorna true se current >= source.length.
	 */
	private isAtEnd(): boolean {
	  return this.current >= this.source.length;
	}
  
	/**
	 * Lê o próximo caractere e processa de acordo:
	 *  - símbolos únicos (parênteses, vírgulas etc.)
	 *  - operadores de dois caracteres (<=, >=, ==, !=)
	 *  - literais (string, número)
	 *  - identificadores ou palavras-chave
	 *  - ignora comentários de linha (“//”).
	 */
	private scanToken(): void {
	  const c = this.advance(); // consome o próximo caractere
  
	  switch (c) {
		// Símbolos de pontuação
		case '(': this.addToken(TokenType.LEFT_PAREN); break;
		case ')': this.addToken(TokenType.RIGHT_PAREN); break;
		case ',': this.addToken(TokenType.COMMA); break;
		case ';': this.addToken(TokenType.SEMICOLON); break;
		case ':': this.addToken(TokenType.COLON); break;
		case '.': this.addToken(TokenType.DOT); break;
  
		// Espaços, tabulações e quebras de linha
		case ' ':
		case '\r':
		case '\t':
		  // simplesmente ignora
		  break;
		case '\n':
		  this.line++; // conta nova linha
		  break;
  
		// Operadores que podem ser únicos ou de dois caracteres
		case '+': this.addToken(TokenType.PLUS); break;
		case '-': this.addToken(TokenType.MINUS); break;
		case '*': this.addToken(TokenType.STAR); break;
		case '/':
		  if (this.match('/')) {
			// “//” encontrado => ignora até o fim da linha
			while (this.peek() !== '\n' && !this.isAtEnd()) this.advance();
		  } else {
			this.addToken(TokenType.SLASH);
		  }
		  break;
		case '%': this.addToken(TokenType.PERCENT); break;
  
		case '!':
		  this.addToken(this.match('=') ? TokenType.BANG_EQUAL : TokenType.BANG);
		  break;
		case '=':
		  this.addToken(this.match('=') ? TokenType.EQUAL_EQUAL : TokenType.EQUAL);
		  break;
		case '<':
		  this.addToken(this.match('=') ? TokenType.LESS_EQUAL : TokenType.LESS);
		  break;
		case '>':
		  this.addToken(this.match('=') ? TokenType.GREATER_EQUAL : TokenType.GREATER);
		  break;
  
		// Literais de string: entre aspas duplas
		case '"': this.string(); break;
  
		default:
		  if (this.isDigit(c)) {
			this.number(); // número literal
		  } else if (this.isAlpha(c)) {
			this.identifier(); // identificador ou palavra‐chave
		  } else {
			throw new Error(`[Linha ${this.line}] Caractere inesperado: '${c}'`);
		  }
		  break;
	  }
	}
  
	/**
	 * Consome o próximo caractere e retorna-o.
	 */
	private advance(): string {
	  return this.source.charAt(this.current++);
	}
  
	/**
	 * Tenta corresponder ao caractere esperado. Se for igual, avança current e retorna true.
	 */
	private match(expected: string): boolean {
	  if (this.isAtEnd()) return false;
	  if (this.source.charAt(this.current) !== expected) return false;
	  this.current++;
	  return true;
	}
  
	/**
	 * Retorna o caractere atual sem consumir (ou '\0' se no fim).
	 */
	private peek(): string {
	  if (this.isAtEnd()) return '\0';
	  return this.source.charAt(this.current);
	}
  
	/**
	 * Retorna o próximo caractere (um ahead) sem consumir.
	 */
	private peekNext(): string {
	  if (this.current + 1 >= this.source.length) return '\0';
	  return this.source.charAt(this.current + 1);
	}
  
	/**
	 * Adiciona um token de tipo `type` com literal=null.
	 */
	private addToken(type: TokenType, literal: any = null): void {
	  const text = this.source.substring(this.start, this.current);
	  this.tokens.push(new Token(type, text, literal, this.line));
	}
  
	/**
	 * Verifica se c é dígito [0-9].
	 */
	private isDigit(c: string): boolean {
	  return c >= '0' && c <= '9';
	}
  
	/**
	 * Processa literais numéricos (inteiro ou real).
	 * Se encontrar um ponto seguido de dígitos, é literal real (float).
	 */
	private number(): void {
	  while (this.isDigit(this.peek())) this.advance();
  
	  // Caso seja real com parte fracionária
	  if (this.peek() === '.' && this.isDigit(this.peekNext())) {
		// consome o '.'
		this.advance();
  
		// consome os dígitos da parte fracionária
		while (this.isDigit(this.peek())) this.advance();
	  }
  
	  // Converte substring em número
	  const value = parseFloat(this.source.substring(this.start, this.current));
	  this.addToken(TokenType.NUMBER, value);
	}
  
	/**
	 * Identifica identificadores e palavras‐chave.
	 * Aceita letras, dígitos e underscore, porém não começa com dígito.
	 */
	private identifier(): void {
	  while (this.isAlphaNumeric(this.peek())) this.advance();
  
	  // Texto extraído (em caixa‐baixa para pesquisa em palavras‐chave)
	  const text = this.source.substring(this.start, this.current).toLowerCase();
  
	  // Se for palavra‐chave, tipo é keyword, senão IDENTIFIER
	  const type = this.keywords[text] ?? TokenType.IDENTIFIER;
	  this.addToken(type);
	}
  
	/**
	 * Retorna true se c é letra ou underscore.
	 */
	private isAlpha(c: string): boolean {
	  return (c >= 'a' && c <= 'z') ||
			 (c >= 'A' && c <= 'Z') ||
			 c === '_';
	}
  
	/**
	 * Retorna true se c é letra, dígito ou underscore.
	 */
	private isAlphaNumeric(c: string): boolean {
	  return this.isAlpha(c) || this.isDigit(c);
	}
  
	/**
	 * Processa literais de string, até encontrar a próxima '"'.
	 * Se EoF for alcançado antes de fechar, erro.
	 */
	private string(): void {
	  // Enquanto não fechar a string e não acabar o arquivo
	  while (this.peek() !== '"' && !this.isAtEnd()) {
		if (this.peek() === '\n') this.line++;
		this.advance();
	  }
  
	  // Se entrou no fim sem achar "
	  if (this.isAtEnd()) {
		throw new Error(`[Linha ${this.line}] String não finalizada.`);
	  }
  
	  // Consome o '"'
	  this.advance();
  
	  // O literal é tudo entre as aspas, sem os delimitadores
	  const value = this.source.substring(this.start + 1, this.current - 1);
	  this.addToken(TokenType.STRING, value);
	}
  }
  
  ///////////////////////
  // 3) DEFINIÇÃO DA AST (NÓS DE SINTAXE)
  ///////////////////////
  
  /**
   * Cada nó da AST implementa a interface `ASTNode`.
   * Os principais tipos de nodes são:
   *   - Program: lista de declarações e comandos
   *   - Declarações: VarDecl, ConstDecl, FuncDecl, ProcDecl
   *   - Instruções: Assign, IfStmt, WhileStmt, ForStmt, RepeatStmt, WriteStmt, ReadStmt, EscolhaStmt, InterrompaStmt, RetorneStmt, CallStmt
   *   - Expressões: BinaryExpr, UnaryExpr, Literal, VariableRef, FuncCallExpr, CastExpr
   */
  ///////////////////////
  // 3.1) Interfaces genéricas
  ///////////////////////
  
  /** Nó base (marker) */
  interface ASTNode { }
  
  /** Expressão (retorna valor) */
  interface Expr extends ASTNode { }
  
  /** Instrução (comando) */
  interface Stmt extends ASTNode { }
  
  ///////////////////////
  // 3.2) Nós de Expressão
  ///////////////////////
  
  /** Literal numérico (inteiro ou real) ou string ou booleano */
  class LiteralExpr implements Expr {
	value: any;   // number | string | boolean
	constructor(value: any) {
	  this.value = value;
	}
  }
  
  /** Referência a variável (ex.: "x", "nome") */
  class VariableExpr implements Expr {
	name: string;
	constructor(name: string) {
	  this.name = name;
	}
  }
  
  /** Chamada de função que retorna valor (ex.: Abs(x), Copia(str,1,3)) */
  class FuncCallExpr implements Expr {
	name: string;       // nome da função
	args: Expr[];       // lista de expressões de argumento
	constructor(name: string, args: Expr[]) {
	  this.name = name;
	  this.args = args;
	}
  }
  
  /** Operação unária (ex.: -x, NOT flag) */
  class UnaryExpr implements Expr {
	operator: Token;   // token do operador
	right: Expr;       // expressão à direita
	constructor(operator: Token, right: Expr) {
	  this.operator = operator;
	  this.right = right;
	}
  }
  
  /** Operação binária (ex.: x + y, a > b, str + "abc", e lógico etc.) */
  class BinaryExpr implements Expr {
	left: Expr;         // expressão à esquerda
	operator: Token;    // token do operador binário
	right: Expr;        // expressão à direita
	constructor(left: Expr, operator: Token, right: Expr) {
	  this.left = left;
	  this.operator = operator;
	  this.right = right;
	}
  }
  
  /** Expressão de cast explícito (ex.: INT(x), REAL(y), CARAC(c)) */
  class CastExpr implements Expr {
	typeName: string;   // “int”, “real”, “carac” etc.
	expr: Expr;
	constructor(typeName: string, expr: Expr) {
	  this.typeName = typeName;
	  this.expr = expr;
	}
  }
  
  ///////////////////////
  // 3.3) Nós de Declarações
  ///////////////////////
  
  /** Declaração de variável: lista de nomes e tipo (ex.: var a, b: inteiro) */
  class VarDecl implements ASTNode {
	names: string[];     // lista de nomes ("a", "b" etc.)
	typeName: string;    // “inteiro”, “real”, “logico”, “caractere”, “literal”
	constructor(names: string[], typeName: string) {
	  this.names = names;
	  this.typeName = typeName;
	}
  }
  
  /** Declaração de constante: nome, tipo e valor literal (ex.: const pi: real <- 3.1415) */
  class ConstDecl implements ASTNode {
	name: string;        // nome da constante
	typeName: string;    // tipo (“inteiro”, “real”, “literal” etc.)
	value: Expr;         // expressão literal
	constructor(name: string, typeName: string, value: Expr) {
	  this.name = name;
	  this.typeName = typeName;
	  this.value = value;
	}
  }
  
  /** Declaração de função (UDF): nome, parâmetros, tipo de retorno, corpo (lista de comandos) */
  class FuncDecl implements ASTNode {
	name: string;              // nome da função
	params: { name: string; typeName: string }[]; // parâmetros formais
	returnType: string;        // tipo de retorno (ex.: “inteiro”)
	body: Stmt[];              // lista de comandos
	constructor(
	  name: string,
	  params: { name: string; typeName: string }[],
	  returnType: string,
	  body: Stmt[]
	) {
	  this.name = name;
	  this.params = params;
	  this.returnType = returnType;
	  this.body = body;
	}
  }
  
  /** Declaração de procedimento (UDF sem retorno): nome, parâmetros, corpo */
  class ProcDecl implements ASTNode {
	name: string;
	params: { name: string; typeName: string }[];
	body: Stmt[];
	constructor(name: string, params: { name: string; typeName: string }[], body: Stmt[]) {
	  this.name = name;
	  this.params = params;
	  this.body = body;
	}
  }
  
  ///////////////////////
  // 3.4) Nós de Instrução (Stmt)
  ///////////////////////
  
  /** Instrução de atribuição: x <- expr */
  class AssignStmt implements Stmt {
	name: string;  // nome da variável
	expr: Expr;    // expressão a ser avaliada e atribuída
	constructor(name: string, expr: Expr) {
	  this.name = name;
	  this.expr = expr;
	}
  }
  
  /** ESCREVA(expr1, expr2, ...) ou ESCREVAL */
  class WriteStmt implements Stmt {
	args: Expr[];        // lista de expressões a imprimir
	newline: boolean;    // true se ESCREVAL (pular linha)
	constructor(args: Expr[], newline: boolean) {
	  this.args = args;
	  this.newline = newline;
	}
  }
  
  /** LEIA(varName) */
  class ReadStmt implements Stmt {
	name: string;
	constructor(name: string) {
	  this.name = name;
	}
  }
  
  /** SE condicao ENTAO bloco [SENAO bloco] FIMSE */
  class IfStmt implements Stmt {
	condition: Expr;   // expressão condicional
	thenBranch: Stmt[]; // comandos do “então”
	elseBranch: Stmt[] | null; // comandos do “senão” (ou null)
	constructor(condition: Expr, thenBranch: Stmt[], elseBranch: Stmt[] | null) {
	  this.condition = condition;
	  this.thenBranch = thenBranch;
	  this.elseBranch = elseBranch;
	}
  }
  
  /** ESCOLHA varName
   *    CASO valor1: bloco
   *    CASO valor2: bloco
   *    OUTROCASO: bloco
   *  FIMESCOLHA
   */
  class SwitchCaseStmt implements Stmt {
	variable: string;           // nome da variável usada em “escolha”
	cases: { value: Expr; body: Stmt[] }[];  // lista de pares (valor, corpo)
	defaultBody: Stmt[] | null; // bloco de OUTROCASO
	constructor(
	  variable: string,
	  cases: { value: Expr; body: Stmt[] }[],
	  defaultBody: Stmt[] | null
	) {
	  this.variable = variable;
	  this.cases = cases;
	  this.defaultBody = defaultBody;
	}
  }
  
  /** PARA var DE start ATE end [PASSO step] FACA corpo FIMPARA */
  class ForStmt implements Stmt {
	varName: string;    // nome da variável de loop
	start: Expr;        // expressão de início
	end: Expr;          // expressão de fim
	step: Expr | null;  // expressão de passo (ou null => passo 1)
	body: Stmt[];       // comandos dentro do loop
	constructor(
	  varName: string,
	  start: Expr,
	  end: Expr,
	  step: Expr | null,
	  body: Stmt[]
	) {
	  this.varName = varName;
	  this.start = start;
	  this.end = end;
	  this.step = step;
	  this.body = body;
	}
  }
  
  /** ENQUANTO condicao FACA corpo FIMENQUANTO */
  class WhileStmt implements Stmt {
	condition: Expr;
	body: Stmt[];
	constructor(condition: Expr, body: Stmt[]) {
	  this.condition = condition;
	  this.body = body;
	}
  }
  
  /** REPITA corpo ATE condicao */
  class RepeatStmt implements Stmt {
	body: Stmt[];
	condition: Expr;
	constructor(body: Stmt[], condition: Expr) {
	  this.body = body;
	  this.condition = condition;
	}
  }
  
  /** INTERROMPA */
  class BreakStmt implements Stmt {
	constructor() { }
  }
  
  /** RETORNE expr (em função) */
  class ReturnStmt implements Stmt {
	value: Expr | null; // expressão de retorno (ou null se sem valor)
	constructor(value: Expr | null) {
	  this.value = value;
	}
  }
  
  /** CHAMADA DE FUNÇÃO sem atribuição (ex.: Procedimento ou função usada como statement) */
  class CallStmt implements Stmt {
	name: string;    // nome da função/procedimento
	args: Expr[];    // lista de argumentos
	constructor(name: string, args: Expr[]) {
	  this.name = name;
	  this.args = args;
	}
  }
  
  /** PAUSA ou LIMITELA (LimpaTela) */
  class SimpleStmt implements Stmt {
	type: TokenType; // TokenType.PAUSA ou TokenType.LIMITELA
	constructor(type: TokenType) {
	  this.type = type;
	}
  }
  
  ///////////////////////
  // 4) PARSER (ANÁLISE SINTÁTICA)
  ///////////////////////
  
  /**
   * O Parser consome a lista de tokens gerada pelo Lexer e produz uma AST.
   * A estratégia é recursive‐descent: cada método parseX engloba uma regra de
   * gramática que consome tokens e cria nós adequados.
   */
  class Parser {
	private tokens: Token[];
	private current: number = 0; // índice do próximo token a ser consumido
  
	constructor(tokens: Token[]) {
	  this.tokens = tokens;
	}
  
	/**
	 * Ponto de entrada: analisa todo o programa e retorna uma lista de declarações/stmt.
	 */
	parse(): ASTNode[] {
	  const nodes: ASTNode[] = [];
	  while (!this.isAtEnd()) {
		// Pode ser declaração (var, const, funcao, procedimento) ou comando (escreva, se etc.)
		if (this.match(TokenType.VAR)) {
		  nodes.push(this.varDeclaration());
		} else if (this.match(TokenType.CONST)) {
		  nodes.push(this.constDeclaration());
		} else if (this.match(TokenType.FUNCAO)) {
		  nodes.push(this.funcDeclaration());
		} else if (this.match(TokenType.PROCEDIMENTO)) {
		  nodes.push(this.procDeclaration());
		} else if (this.match(TokenType.INICIO)) {
		  // Pulamos “INICIO” inicial; o corpo do programa vem após.
		  // Na sintaxe do Visualg, “INICIO ... FIMALGORITMO”.
		  const stmts = this.blockUntil(TokenType.FIMALGORITMO);
		  // Adicionamos todos stmts do bloco
		  for (const s of stmts) nodes.push(s);
		} else {
		  // Se não for nenhum dos acima, deve ser comando “solto” (atribuicao, escrita, leia etc.)
		  nodes.push(this.statement());
		}
	  }
	  return nodes;
	}
  
	/**
	 * VarDeclaration -> VAR identifier (',' identifier)* ':' typeName ';'
	 */
	private varDeclaration(): VarDecl {
	  // Já consumimos “VAR”
	  const names: string[] = [];
	  // Ao menos um identificador
	  do {
		const token = this.consume(TokenType.IDENTIFIER, "Esperava identificador em declaração de variável.");
		names.push(token.lexeme);
	  } while (this.match(TokenType.COMMA));
	  this.consume(TokenType.COLON, "Esperava ':' após lista de variáveis.");
	  const typeToken = this.consumeTypeName();
	  this.consume(TokenType.SEMICOLON, "Esperava ';' após declaração de variável.");
	  return new VarDecl(names, typeToken.lexeme.toLowerCase());
	}
  
	/**
	 * ConstDeclaration -> CONST identifier ':' typeName '<-' expression ';'
	 */
	private constDeclaration(): ConstDecl {
	  // Já consumimos “CONST”
	  const nameToken = this.consume(TokenType.IDENTIFIER, "Esperava identificador em declaração de constante.");
	  this.consume(TokenType.COLON, "Esperava ':' após nome da constante.");
	  const typeToken = this.consumeTypeName();
	  // Sintaxe do Visualg: “<-” para atribuir valor
	  this.consume(TokenType.LESS, "Esperava '<' em declaração de constante.");
	  this.consume(TokenType.MINUS, "Esperava '-' em declaração de constante."); // sob hipótese de lexing, '<-' vira LESS e MINUS
	  const valueExpr = this.expression();
	  this.consume(TokenType.SEMICOLON, "Esperava ';' após declaração de constante.");
	  return new ConstDecl(nameToken.lexeme, typeToken.lexeme.toLowerCase(), valueExpr);
	}
  
	/**
	 * FuncDeclaration -> FUNCAO identifier '(' [params] ')' ':' typeName ';'
	 *                    bloco (até FIMFUNCAO) ';'
	 */
	private funcDeclaration(): FuncDecl {
	  // Já consumimos “FUNCAO”
	  const nameToken = this.consume(TokenType.IDENTIFIER, "Esperava nome da função.");
	  this.consume(TokenType.LEFT_PAREN, "Esperava '(' após nome da função.");
	  const params = this.parseParams();
	  this.consume(TokenType.RIGHT_PAREN, "Esperava ')' após parâmetros da função.");
	  this.consume(TokenType.COLON, "Esperava ':' após ')'.");
	  const typeToken = this.consumeTypeName();
	  this.consume(TokenType.SEMICOLON, "Esperava ';' após tipo de retorno da função.");
	  // A partir de agora, lemos comandos até “FIMFUNCAO”
	  const body = this.blockUntil(TokenType.FIMFUNCAO);
	  this.consume(TokenType.SEMICOLON, "Esperava ';' após FIMFUNCAO.");
	  return new FuncDecl(nameToken.lexeme, params, typeToken.lexeme.toLowerCase(), body);
	}
  
	/**
	 * ProcDeclaration -> PROCEDIMENTO identifier '(' [params] ')' ';'
	 *                    bloco (até FIMPROCEDIMENTO) ';'
	 */
	private procDeclaration(): ProcDecl {
	  // Já consumimos “PROCEDIMENTO”
	  const nameToken = this.consume(TokenType.IDENTIFIER, "Esperava nome do procedimento.");
	  this.consume(TokenType.LEFT_PAREN, "Esperava '(' após nome do procedimento.");
	  const params = this.parseParams();
	  this.consume(TokenType.RIGHT_PAREN, "Esperava ')' após parâmetros do procedimento.");
	  this.consume(TokenType.SEMICOLON, "Esperava ';' após PROCEDIMENTO(...).");
	  // Lê comandos até “FIMPROCEDIMENTO”
	  const body = this.blockUntil(TokenType.FIMPROCEDIMENTO);
	  this.consume(TokenType.SEMICOLON, "Esperava ';' após FIMPROCEDIMENTO.");
	  return new ProcDecl(nameToken.lexeme, params, body);
	}
  
	/**
	 * Parse de parâmetros formais: identifier ':' typeName (',' identifier ':' typeName)*
	 */
	private parseParams(): { name: string; typeName: string }[] {
	  const params: { name: string; typeName: string }[] = [];
	  // Se próximo for IDENTIFIER, temos pelo menos um parâmetro
	  if (!this.check(TokenType.RIGHT_PAREN)) {
		do {
		  const paramName = this.consume(TokenType.IDENTIFIER, "Esperava nome de parâmetro.").lexeme;
		  this.consume(TokenType.COLON, "Esperava ':' após nome de parâmetro.");
		  const typeToken = this.consumeTypeName();
		  params.push({ name: paramName, typeName: typeToken.lexeme.toLowerCase() });
		} while (this.match(TokenType.COMMA));
	  }
	  return params;
	}
  
	/**
	 * Consome um token de tipo de dado (INTEIRO, REAL, LOGICO, CARACTERE, LITERAL).
	 */
	private consumeTypeName(): Token {
	  if (this.match(TokenType.INTEIRO)) return this.previous();
	  if (this.match(TokenType.REAL)) return this.previous();
	  if (this.match(TokenType.LOGICO)) return this.previous();
	  if (this.match(TokenType.CARACTERE)) return this.previous();
	  if (this.match(TokenType.LITERAL)) return this.previous();
	  throw new Error(`[Linha ${this.peek().line}] Esperava tipo de dado (inteiro, real, lógico, caractere, literal).`);
	}
  
	/**
	 * Lê comandos até encontrar um token de término (ex.: FIMALGORITMO, FIMFUNCAO, FIMPROCEDIMENTO).
	 * Retorna array de Stmt.
	 */
	private blockUntil(endType: TokenType): Stmt[] {
	  const statements: Stmt[] = [];
	  // Enquanto não for o token de término e não for EOF...
	  while (!this.check(endType) && !this.isAtEnd()) {
		statements.push(this.statement());
	  }
	  // Consome o token endType (FIM...)
	  this.consume(endType, `Esperava '${TokenType[endType]}' para finalizar bloco.`);
	  return statements;
	}
  
	/**
	 * Statement ->
	 *    simpleStmt        // PAUSA, LIMITELA
	 *  | assignStmt        // identifier '<-' expr ';'
	 *  | writeStmt
	 *  | readStmt
	 *  | ifStmt
	 *  | switchCaseStmt
	 *  | forStmt
	 *  | whileStmt
	 *  | repeatStmt
	 *  | breakStmt
	 *  | returnStmt
	 *  | callStmt          // identifier '(' [args] ')' ';'
	 */
	private statement(): Stmt {
	  if (this.match(TokenType.PAUSA, TokenType.LIMITELA)) {
		// PAUSA ou LimpaTela
		const type = this.previous().type;
		this.consume(TokenType.SEMICOLON, "Esperava ';' após comando.");
		return new SimpleStmt(type);
	  }
  
	  if (this.match(TokenType.IDENTIFIER)) {
		// Pode ser atribuição (nome <- expr) ou chamada de função (nome(...))
		const idToken = this.previous();
		if (this.match(TokenType.LESS)) {
		  // Encontrou "<" => deve haver "-", confirmamos
		  this.consume(TokenType.MINUS, "Esperava '-' após '<' em atribuição.");
		  const expr = this.expression();
		  this.consume(TokenType.SEMICOLON, "Esperava ';' após atribuição.");
		  return new AssignStmt(idToken.lexeme, expr);
		} else if (this.match(TokenType.LEFT_PAREN)) {
		  // Chamada de função / procedimento
		  const args = this.parseArgs(); // chama parseArgs (antes era parseArgList)
		  this.consume(TokenType.RIGHT_PAREN, "Esperava ')' após argumentos.");
		  this.consume(TokenType.SEMICOLON, "Esperava ';' após chamada.");
		  return new CallStmt(idToken.lexeme, args);
		} else {
		  throw new Error(`[Linha ${idToken.line}] Identificador sem '<-' ou '('.`);
		}
	  }
  
	  if (this.match(TokenType.ESCREVA, TokenType.ESCREVAL)) {
		// ESCREVA ou ESCREVAL
		const newline = this.previous().type === TokenType.ESCREVAL;
		this.consume(TokenType.LEFT_PAREN, "Esperava '(' após ESCREVA/ESCREVAL.");
		const args = this.parseArgs(); // chama parseArgs
		this.consume(TokenType.RIGHT_PAREN, "Esperava ')' após lista de argumentos de ESCREVA.");
		this.consume(TokenType.SEMICOLON, "Esperava ';' após ESCREVA.");
		return new WriteStmt(args, newline);
	  }
  
	  if (this.match(TokenType.LEIA)) {
		// LEIA(varName);
		this.consume(TokenType.LEFT_PAREN, "Esperava '(' após LEIA.");
		const nameToken = this.consume(TokenType.IDENTIFIER, "Esperava nome de variável em LEIA.");
		this.consume(TokenType.RIGHT_PAREN, "Esperava ')' após LEIA.");
		this.consume(TokenType.SEMICOLON, "Esperava ';' após LEIA.");
		return new ReadStmt(nameToken.lexeme);
	  }
  
	  if (this.match(TokenType.SE)) {
		return this.ifStatement();
	  }
  
	  if (this.match(TokenType.ESCOLHA)) {
		return this.switchCaseStatement();
	  }
  
	  if (this.match(TokenType.PARA)) {
		return this.forStatement();
	  }
  
	  if (this.match(TokenType.ENQUANTO)) {
		return this.whileStatement();
	  }
  
	  if (this.match(TokenType.REPITA)) {
		return this.repeatStatement();
	  }
  
	  if (this.match(TokenType.INTERROMPA)) {
		this.consume(TokenType.SEMICOLON, "Esperava ';' após INTERROMPA.");
		return new BreakStmt();
	  }
  
	  if (this.match(TokenType.RETORNE)) {
		// RETORNE [expr]?;
		let value: Expr | null = null;
		if (!this.check(TokenType.SEMICOLON)) {
		  value = this.expression();
		}
		this.consume(TokenType.SEMICOLON, "Esperava ';' após RETORNE.");
		return new ReturnStmt(value);
	  }
  
	  // Se não caiu em nenhum dos casos acima, erro de sintaxe:
	  throw new Error(`[Linha ${this.peek().line}] Comando/declaração não reconhecido.`);
	}
  
	/**
	 * IfStmt -> SE '('? expression ')' ENTAO bloco [SENAO bloco]? FIMSE ';'?
	 * Observação: O Visualg não exige parênteses em volta da condição – adotamos sintaxe flexível.
	 */
	private ifStatement(): IfStmt {
	  // Já consumimos “SE”
	  // Pode vir condição sem parênteses
	  let condition: Expr;
	  if (this.match(TokenType.LEFT_PAREN)) {
		condition = this.expression();
		this.consume(TokenType.RIGHT_PAREN, "Esperava ')' após condição de SE.");
	  } else {
		condition = this.expression();
	  }
	  this.consume(TokenType.ENTAO, "Esperava 'ENTAO' após condição de SE.");
	  // Após “ENTAO” lemos comandos até que encontremos “SENAO” (opcional) ou “FIMSE”
	  const thenBranch: Stmt[] = [];
	  while (!this.check(TokenType.SENAO) && !this.check(TokenType.FIMSE) && !this.isAtEnd()) {
		thenBranch.push(this.statement());
	  }
	  let elseBranch: Stmt[] | null = null;
	  if (this.match(TokenType.SENAO)) {
		elseBranch = [];
		while (!this.check(TokenType.FIMSE) && !this.isAtEnd()) {
		  elseBranch.push(this.statement());
		}
	  }
	  this.consume(TokenType.FIMSE, "Esperava 'FIMSE' após bloco de SE/SENAO.");
	  // Opcionalmente: ponto‐e‐vírgula
	  if (this.match(TokenType.SEMICOLON)) { /* ignora */ }
	  return new IfStmt(condition, thenBranch, elseBranch);
	}
  
	/**
	 * SwitchCaseStmt -> ESCOLHA identifier
	 *    (CASO literal ':' comandos)*
	 *    [OUTROCASO ':' comandos]
	 *  FIMESCOLHA ';'
	 */
	private switchCaseStatement(): SwitchCaseStmt {
	  // Já consumimos “ESCOLHA”
	  const varToken = this.consume(TokenType.IDENTIFIER, "Esperava variável após ESCOLHA.");
	  const cases: { value: Expr; body: Stmt[] }[] = [];
	  let defaultBody: Stmt[] | null = null;
  
	  // Lê vários CASO ...
	  while (this.match(TokenType.CASO)) {
		// Após CASO vem um literal (número ou string ou verdadeiro/falso)
		const valueExpr = this.literalExpression();
		this.consume(TokenType.COLON, "Esperava ':' após valor do CASO.");
		// Lê comandos até encontrar CASO, OUTROCASO ou FIMESCOLHA
		const body: Stmt[] = [];
		while (!this.check(TokenType.CASO) && !this.check(TokenType.OUTROCASO) && !this.check(TokenType.FIMESCOLHA) && !this.isAtEnd()) {
		  body.push(this.statement());
		}
		cases.push({ value: valueExpr, body });
	  }
  
	  // Bloco de OUTROCASO (opcional)
	  if (this.match(TokenType.OUTROCASO)) {
		this.consume(TokenType.COLON, "Esperava ':' após OUTROCASO.");
		defaultBody = [];
		while (!this.check(TokenType.FIMESCOLHA) && !this.isAtEnd()) {
		  defaultBody.push(this.statement());
		}
	  }
  
	  this.consume(TokenType.FIMESCOLHA, "Esperava 'FIMESCOLHA' para fechar ESCOLHA.");
	  // Opcional: ponto‐e‐vírgula
	  if (this.match(TokenType.SEMICOLON)) { /* ignora */ }
	  return new SwitchCaseStmt(varToken.lexeme, cases, defaultBody);
	}
  
	/**
	 * ForStmt -> PARA identifier DE expr ATE expr [PASSO expr]? FACA
	 *            comandos...
	 *           FIMPARA ';'
	 */
	private forStatement(): ForStmt {
	  // Já consumimos “PARA”
	  const nameToken = this.consume(TokenType.IDENTIFIER, "Esperava variável após PARA.");
	  this.consume(TokenType.DE, "Esperava 'DE' em comando PARA.");
	  const startExpr = this.expression();
	  this.consume(TokenType.ATE, "Esperava 'ATE' em comando PARA.");
	  const endExpr = this.expression();
	  let stepExpr: Expr | null = null;
	  if (this.match(TokenType.PASSO)) {
		stepExpr = this.expression();
	  }
	  this.consume(TokenType.FACA, "Esperava 'FACA' em comando PARA.");
	  // Lê corpo até FIMPARA
	  const body: Stmt[] = [];
	  while (!this.check(TokenType.FIMPARA) && !this.isAtEnd()) {
		body.push(this.statement());
	  }
	  this.consume(TokenType.FIMPARA, "Esperava 'FIMPARA' para fechar FOR.");
	  // Opcional: ponto‐e‐vírgula
	  if (this.match(TokenType.SEMICOLON)) { /* ignora */ }
	  return new ForStmt(nameToken.lexeme, startExpr, endExpr, stepExpr, body);
	}
  
	/**
	 * WhileStmt -> ENQUANTO expr FACA comandos... FIMENQUANTO ';'
	 */
	private whileStatement(): WhileStmt {
	  // Já consumimos “ENQUANTO”
	  const condition = this.expression();
	  this.consume(TokenType.FACA, "Esperava 'FACA' em comando ENQUANTO.");
	  const body: Stmt[] = [];
	  while (!this.check(TokenType.FIMENQUANTO) && !this.isAtEnd()) {
		body.push(this.statement());
	  }
	  this.consume(TokenType.FIMENQUANTO, "Esperava 'FIMENQUANTO' após loop.");
	  if (this.match(TokenType.SEMICOLON)) { /* ignora */ }
	  return new WhileStmt(condition, body);
	}
  
	/**
	 * RepeatStmt -> REPITA comandos... ATE expr ';'
	 */
	private repeatStatement(): RepeatStmt {
	  // Já consumimos “REPITA”
	  const body: Stmt[] = [];
	  while (!this.check(TokenType.ATE)) {
		body.push(this.statement());
	  }
	  // Achamos “ATE”; expressão condicional a seguir
	  this.consume(TokenType.ATE, "Esperava 'ATE' em REPITA.");
	  const condition = this.expression();
	  this.consume(TokenType.SEMICOLON, "Esperava ';' após comando REPITA.");
	  return new RepeatStmt(body, condition);
	}
  
	///////////////////
	// EXPRESSÕES
	///////////////////
  
	/**
	 * Chamamos expr -> logic_or ;
	 * Implementamos precedência:
	 *   logic_or    -> logic_and ( ( 'OU' | 'XOR' ) logic_and )* ;
	 *   logic_and   -> equality ( 'E' equality )* ;
	 *   equality    -> comparison ( ( '==' | '!=' ) comparison )* ;
	 *   comparison  -> addition ( ( '>' | '>=' | '<' | '<=' ) addition )* ;
	 *   addition    -> multiplication ( ( '+' | '-' ) multiplication )* ;
	 *   multiplication -> unary ( ( '*' | '/' | 'DIV' | 'MOD' ) unary )* ;
	 *   unary       -> ( 'NAO' | '-' ) unary | primary ;
	 *   primary     -> literal | identifier | funcCall | '(' expr ')' | castExpr ;
	 */
  
	private expression(): Expr {
	  return this.logicOr();
	}
  
	private logicOr(): Expr {
	  let expr = this.logicAnd();
	  while (this.match(TokenType.OR, TokenType.XOR)) {
		const operator = this.previous();
		const right = this.logicAnd();
		expr = new BinaryExpr(expr, operator, right);
	  }
	  return expr;
	}
  
	private logicAnd(): Expr {
	  let expr = this.equality();
	  while (this.match(TokenType.AND)) {
		const operator = this.previous();
		const right = this.equality();
		expr = new BinaryExpr(expr, operator, right);
	  }
	  return expr;
	}
  
	private equality(): Expr {
	  let expr = this.comparison();
	  while (this.match(TokenType.BANG_EQUAL, TokenType.EQUAL_EQUAL)) {
		const operator = this.previous();
		const right = this.comparison();
		expr = new BinaryExpr(expr, operator, right);
	  }
	  return expr;
	}
  
	private comparison(): Expr {
	  let expr = this.addition();
	  while (this.match(TokenType.GREATER, TokenType.GREATER_EQUAL, TokenType.LESS, TokenType.LESS_EQUAL)) {
		const operator = this.previous();
		const right = this.addition();
		expr = new BinaryExpr(expr, operator, right);
	  }
	  return expr;
	}
  
	private addition(): Expr {
	  let expr = this.multiplication();
	  while (this.match(TokenType.PLUS, TokenType.MINUS)) {
		const operator = this.previous();
		const right = this.multiplication();
		expr = new BinaryExpr(expr, operator, right);
	  }
	  return expr;
	}
  
	private multiplication(): Expr {
	  let expr = this.unary();
	  while (this.match(TokenType.STAR, TokenType.SLASH, TokenType.DIV, TokenType.MOD)) {
		const operator = this.previous();
		const right = this.unary();
		expr = new BinaryExpr(expr, operator, right);
	  }
	  return expr;
	}
  
	private unary(): Expr {
	  if (this.match(TokenType.NOT, TokenType.MINUS)) {
		const operator = this.previous();
		const right = this.unary();
		return new UnaryExpr(operator, right);
	  }
	  return this.primary();
	}
  
	/**
	 * primary -> NUMBER | STRING | VERDADEIRO | FALSO | IDENTIFIER (functionCall?) | '(' expression ')' | castExpr
	 */
	private primary(): Expr {
	  if (this.match(TokenType.NUMBER)) {
		return new LiteralExpr(this.previous().literal);
	  }
	  if (this.match(TokenType.STRING)) {
		return new LiteralExpr(this.previous().literal);
	  }
	  if (this.match(TokenType.VERDADEIRO)) {
		return new LiteralExpr(true);
	  }
	  if (this.match(TokenType.FALSO)) {
		return new LiteralExpr(false);
	  }
	  if (this.match(TokenType.IDENTIFIER)) {
		const name = this.previous().lexeme;
		// Verifica chamada de função: se próximo for '('
		if (this.match(TokenType.LEFT_PAREN)) {
		  // Parse de argumentos
		  const args = this.parseArgs();
		  this.consume(TokenType.RIGHT_PAREN, "Esperava ')' após argumentos de função.");
		  return new FuncCallExpr(name, args);
		}
		// Senão, é referência a variável
		return new VariableExpr(name);
	  }
	  if (this.match(TokenType.LEFT_PAREN)) {
		const expr = this.expression();
		this.consume(TokenType.RIGHT_PAREN, "Esperava ')' após expressão.");
		return expr;
	  }
	  // Cast explícito: INT(expr), REAL(expr), CARAC(expr), etc.
	  if (this.match(TokenType.INT, TokenType.REAL, TokenType.CARAC)) {
		const typeName = this.previous().lexeme.toLowerCase();
		this.consume(TokenType.LEFT_PAREN, `Esperava '(' após ${typeName}.`);
		const expr = this.expression();
		this.consume(TokenType.RIGHT_PAREN, `Esperava ')' após expressão em ${typeName}.`);
		return new CastExpr(typeName, expr);
	  }
	  throw new Error(`[Linha ${this.peek().line}] Expressão inválida.`);
	}
  
	/**
	 * Parse de lista de argumentos: expr (',' expr)*
	 */
	private parseArgs(): Expr[] {
	  const args: Expr[] = [];
	  if (!this.check(TokenType.RIGHT_PAREN)) {
		do {
		  args.push(this.expression());
		} while (this.match(TokenType.COMMA));
	  }
	  return args;
	}
  
	/**
	 * Retorna uma expressão literal (usada em CASO): NUMBER | STRING | VERDADEIRO | FALSO
	 */
	private literalExpression(): Expr {
	  if (this.match(TokenType.NUMBER)) {
		return new LiteralExpr(this.previous().literal);
	  }
	  if (this.match(TokenType.STRING)) {
		return new LiteralExpr(this.previous().literal);
	  }
	  if (this.match(TokenType.VERDADEIRO)) {
		return new LiteralExpr(true);
	  }
	  if (this.match(TokenType.FALSO)) {
		return new LiteralExpr(false);
	  }
	  throw new Error(`[Linha ${this.peek().line}] Esperava literal para CASO.`);
	}
  
	/////////////////////////
	// AUXILIARES DO PARSER
	/////////////////////////
  
	/**
	 * Consome token de tipo “type” ou dispara erro com “message”.
	 */
	private consume(type: TokenType, message: string): Token {
	  if (this.check(type)) return this.advance();
	  throw new Error(`[Linha ${this.peek().line}] ${message} (achado: ${TokenType[this.peek().type]}).`);
	}
  
	/**
	 * Verifica se o próximo token é do tipo dado, sem consumi‐lo.
	 */
	private check(type: TokenType): boolean {
	  if (this.isAtEnd()) return false;
	  return this.peek().type === type;
	}
  
	/**
	 * Retorna o token atual sem consumir.
	 */
	private peek(): Token {
	  return this.tokens[this.current];
	}
  
	/**
	 * Retorna o token anterior (já consumido).
	 */
	private previous(): Token {
	  return this.tokens[this.current - 1];
	}
  
	/**
	 * Consome e retorna o token atual se não for EOF, avança current.
	 */
	private advance(): Token {
	  if (!this.isAtEnd()) this.current++;
	  return this.previous();
	}
  
	/**
	 * Retorna true se chegamos ao EOF.
	 */
	private isAtEnd(): boolean {
	  return this.peek().type === TokenType.EOF;
	}
  
	/**
	 * Se o próximo token tiver um dos tipos fornecidos, consome‐o e retorna true.
	 */
	private match(...types: TokenType[]): boolean {
	  for (const t of types) {
		if (this.check(t)) {
		  this.advance();
		  return true;
		}
	  }
	  return false;
	}
  }
  
  ///////////////////////
  // 5) INTERPRETADOR (EXECUTOR DA AST)
  ///////////////////////
  
  /**
   * O Interpreter executa a AST resultante do Parser.
   * Mantém:
   *   - Um “environment” global (tabela de símbolos) para variáveis e constantes.
   *   - Pilha de chamadas para funções/procedimentos, cada escopo tendo seu próprio env.
   *   - Mapeamento de declarações de função e procedimento para serem chamadas.
   *   - Suporte a INTERROMPA (lançar exceção interna para sair de laço) e RETORNE (lançar valor).
   */
  
  ///////////////////////
  // 5.1) Definições auxiliares de valor
  ///////////////////////
  
  /**
   * ValueType indica os possíveis tipos armazenados em variáveis:
   *   - number => seja inteiro ou real
   *   - string => literal ou caractere
   *   - boolean => lógico
   *   - null   => valor inexistente (usar para inicialização)
   */
  type ValueType = number | string | boolean | null;
  
  /**
   * Cada variável ou constante no ambiente carrega:
   *   - value: o valor atual
   *   - typeName: string (“inteiro”, “real”, “logico”, “caractere”, “literal”)
   *   - readOnly: true se for CONST, false se VAR
   */
  class Variable {
	value: ValueType;
	typeName: string;
	readOnly: boolean;
  
	constructor(typeName: string, value: ValueType, readOnly: boolean = false) {
	  this.typeName = typeName;
	  this.value = value;
	  this.readOnly = readOnly;
	}
  }
  
  /**
   * Environment representa um escopo de variáveis (tabela de símbolos) e possivelmente
   * aponta para um scope externo (para buscas em nível global).
   */
  class Environment {
	private values: Map<string, Variable> = new Map();
	private enclosing: Environment | null; // escopo externo
  
	constructor(enclosing: Environment | null = null) {
	  this.enclosing = enclosing;
	}
  
	/**
	 * Define (ou sobrescreve) uma variável no escopo atual.
	 * Se já existir e for readonly, erro.
	 */
	define(name: string, typeName: string, value: ValueType, readOnly: boolean) {
	  const key = name.toLowerCase();
	  if (this.values.has(key) && this.values.get(key)!.readOnly) {
		throw new Error(`Tentativa de redefinir constante '${name}'.`);
	  }
	  this.values.set(key, new Variable(typeName, value, readOnly));
	}
  
	/**
	 * Atribui valor a variável já existente (procura recursivamente no escopo,
	 * se não existir no atual, tenta no enclosing). Se não found, erro.
	 */
	assign(name: string, value: ValueType) {
	  const key = name.toLowerCase();
	  if (this.values.has(key)) {
		const variable = this.values.get(key)!;
		if (variable.readOnly) {
		  throw new Error(`Tentativa de atribuir à constante '${name}'.`);
		}
		// Converter o valor para o tipo adequado
		variable.value = this.castValue(variable.typeName, value);
		return;
	  }
	  if (this.enclosing !== null) {
		this.enclosing.assign(name, value);
		return;
	  }
	  throw new Error(`Variável '${name}' não declarada.`);
	}
  
	/**
	 * Recupera valor de variável (procura no escopo atual e, se não achar, no enclosing).
	 * Se não encontrada, erro.
	 */
	get(name: string): Variable {
	  const key = name.toLowerCase();
	  if (this.values.has(key)) {
		return this.values.get(key)!;
	  }
	  if (this.enclosing !== null) {
		return this.enclosing.get(name);
	  }
	  throw new Error(`Variável '${name}' não declarada.`);
	}
  
	/**
	 * Converte “rawValue” (que pode ser number|string|boolean|null) para o tipo da variável:
	 *   - Se variável é “inteiro” => Math.trunc(number) ou parse int de string
	 *   - “real” => parseFloat
	 *   - “logico” => apenas boolean
	 *   - “caractere” => string de length=1 ou a primeira posição
	 *   - “literal” => string completa
	 *
	 * OBS: método agora é PUBLIC para ser acessível fora.
	 */
	public castValue(typeName: string, rawValue: any): ValueType {
	  // Se rawValue já for null, mantemos null (inicialização padrão)
	  if (rawValue === null) return null;
  
	  switch (typeName) {
		case "inteiro":
		  if (typeof rawValue === "number") return Math.trunc(rawValue);
		  if (typeof rawValue === "string") {
			const parsed = parseInt(rawValue, 10);
			if (isNaN(parsed)) throw new Error(`Não foi possível converter '${rawValue}' para inteiro.`);
			return parsed;
		  }
		  if (typeof rawValue === "boolean") return rawValue ? 1 : 0;
		  break;
		case "real":
		  if (typeof rawValue === "number") return rawValue;
		  if (typeof rawValue === "string") {
			const parsed = parseFloat(rawValue);
			if (isNaN(parsed)) throw new Error(`Não foi possível converter '${rawValue}' para real.`);
			return parsed;
		  }
		  if (typeof rawValue === "boolean") return rawValue ? 1.0 : 0.0;
		  break;
		case "logico":
		  if (typeof rawValue === "boolean") return rawValue;
		  if (typeof rawValue === "number") return rawValue !== 0;
		  if (typeof rawValue === "string") {
			const lowered = rawValue.toLowerCase();
			if (lowered === "verdadeiro" || lowered === "true") return true;
			if (lowered === "falso" || lowered === "false") return false;
			throw new Error(`Não foi possível converter '${rawValue}' para lógico.`);
		  }
		  break;
		case "caractere":
		  if (typeof rawValue === "string") {
			return rawValue.charAt(0);
		  }
		  if (typeof rawValue === "number") {
			return String.fromCharCode(rawValue);
		  }
		  if (typeof rawValue === "boolean") {
			return rawValue ? "T" : "F";
		  }
		  break;
		case "literal":
		  // Qualquer valor vira string
		  return String(rawValue);
	  }
	  throw new Error(`Tipo incompatível: não é possível converter valor '${rawValue}' para tipo ${typeName}.`);
	}
  }
  
  ///////////////////////
  // 5.2) Exceções Internas para Controle de Fluxo
  ///////////////////////
  
  /**
   * Exceção lançada internamente para sinalizar “break” de laço (INTERROMPA).
   */
  class BreakException {
	constructor() { }
  }
  
  /**
   * Exceção lançada internamente para sinalizar “return” de função, carregando
   * o valor de retorno (ou null se void).
   */
  class ReturnException {
	value: ValueType;
	constructor(value: ValueType) {
	  this.value = value;
	}
  }
  
  ///////////////////////
  // 5.3) TABELAS DE FUNÇÕES E PROCEDIMENTOS
  ///////////////////////
  
  /**
   * Funções pré‐definidas (built‐ins) mapeadas por nome (lowercase) para a
   * implementação JavaScript correspondente.
   *
   * Cada built‐in recebe N argumentos (array de ValueType) e retorna ValueType.
   */
  const builtInFunctions: Record<string, (args: ValueType[]) => ValueType> = {
	// Abs(x): valor absoluto
	"abs": ([x]) => {
	  if (typeof x !== "number") throw new Error("Abs(): argumento não é número.");
	  return Math.abs(x);
	},
	// Log(x): log natural
	"log": ([x]) => {
	  if (typeof x !== "number") throw new Error("Log(): argumento não é número.");
	  return Math.log(x);
	},
	// Sen(x): seno (em radianos)
	"sen": ([x]) => {
	  if (typeof x !== "number") throw new Error("Sen(): argumento não é número.");
	  return Math.sin(x);
	},
	// Cos(x)
	"cos": ([x]) => {
	  if (typeof x !== "number") throw new Error("Cos(): argumento não é número.");
	  return Math.cos(x);
	},
	// Tan(x)
	"tan": ([x]) => {
	  if (typeof x !== "number") throw new Error("Tan(): argumento não é número.");
	  return Math.tan(x);
	},
	// Exp(x): e^x
	"exp": ([x]) => {
	  if (typeof x !== "number") throw new Error("Exp(): argumento não é número.");
	  return Math.exp(x);
	},
	// Pot(base, expoente)
	"pot": ([base, expv]) => {
	  if (typeof base !== "number" || typeof expv !== "number") throw new Error("Pot(): argumentos não são numéricos.");
	  return Math.pow(base, expv);
	},
	// Quad(x): x^2
	"quad": ([x]) => {
	  if (typeof x !== "number") throw new Error("Quad(): argumento não é número.");
	  return x * x;
	},
	// Cotan(x) = 1/tan(x)
	"cotan": ([x]) => {
	  if (typeof x !== "number") throw new Error("Cotan(): argumento não é número.");
	  return 1 / Math.tan(x);
	},
	// ArcSen(x) = arcsin(x)
	"arcsen": ([x]) => {
	  if (typeof x !== "number") throw new Error("ArcSen(): argumento não é número.");
	  return Math.asin(x);
	},
	// ArcCos(x)
	"arccos": ([x]) => {
	  if (typeof x !== "number") throw new Error("ArcCos(): argumento não é número.");
	  return Math.acos(x);
	},
	// RaizQ(x) = sqrt(x)
	"raizq": ([x]) => {
	  if (typeof x !== "number") throw new Error("RaizQ(): argumento não é número.");
	  if (x < 0) throw new Error("RaizQ(): não pode tirar raiz quadrada de número negativo.");
	  return Math.sqrt(x);
	},
	// Rand(): número real [0,1)
	"rand": () => Math.random(),
	// Randi(): número inteiro [0, RAND_MAX) – usamos 32 bits random
	"randi": () => Math.floor(Math.random() * 2147483647),
	// Div(x, y) = divisão inteira
	"div": ([x, y]) => {
	  if (typeof x !== "number" || typeof y !== "number") throw new Error("Div(): argumentos não são números.");
	  if (y === 0) throw new Error("Div(): divisão por zero.");
	  return Math.trunc(x / y);
	},
	// Mod(x, y) = resto
	"mod": ([x, y]) => {
	  if (typeof x !== "number" || typeof y !== "number") throw new Error("Mod(): argumentos não são números.");
	  if (y === 0) throw new Error("Mod(): módulo por zero.");
	  return x % y;
	},
	////////////////////////////////
	// Funções de conversão de string
	////////////////////////////////
	// Pos(sub, str): retorna posição (1-based) da primeira ocorrência de sub em str
	"pos": ([sub, str]) => {
	  if (typeof sub !== "string" || typeof str !== "string")
		throw new Error("Pos(): argumentos não são strings.");
	  const idx = str.indexOf(sub);
	  return idx >= 0 ? idx + 1 : 0;
	},
	// Asc(c): código ASCII de caractere (c deve ser string de length=1)
	"asc": ([c]) => {
	  if (typeof c !== "string" || c.length === 0) throw new Error("Asc(): argumento inválido.");
	  return c.charCodeAt(0);
	},
	// Carac(num): retorna caractere de código num
	"carac": ([num]) => {
	  if (typeof num !== "number") throw new Error("Carac(): argumento não é número.");
	  return String.fromCharCode(num);
	},
	// Copia(str, inicio, comprimento): substring
	"copia": ([str, inicio, comprimento]) => {
	  if (typeof str !== "string" || typeof inicio !== "number" || typeof comprimento !== "number")
		throw new Error("Copia(): argumentos inválidos.");
	  // Visualg usa índices 1-based
	  const i = Math.trunc(inicio) - 1;
	  return str.substr(i, Math.trunc(comprimento));
	},
	// Int(x): converte para inteiro (truncar)
	"int": ([x]) => {
	  if (typeof x === "number") return Math.trunc(x);
	  if (typeof x === "string") {
		const parsed = parseInt(x, 10);
		if (isNaN(parsed)) throw new Error("Int(): string não conversível.");
		return parsed;
	  }
	  throw new Error("Int(): tipo inválido.");
	},
	// Compr(str): comprimento da string
	"compr": ([str]) => {
	  if (typeof str !== "string") throw new Error("Compr(): argumento não é string.");
	  return str.length;
	},
	// Maiusc(str): converte para maiúsculas
	"maiusc": ([str]) => {
	  if (typeof str !== "string") throw new Error("Maiusc(): argumento não é string.");
	  return str.toUpperCase();
	},
	// Minusc(str): converte para minúsculas
	"minusc": ([str]) => {
	  if (typeof str !== "string") throw new Error("Minusc(): argumento não é string.");
	  return str.toLowerCase();
	},
	// NumPCarac(str, posicao): retorna código numérico do caractere na posicao (1-based)
	"numpcarac": ([str, posicao]) => {
	  if (typeof str !== "string" || typeof posicao !== "number") throw new Error("NumPCarac(): argumentos inválidos.");
	  const i = Math.trunc(posicao) - 1;
	  if (i < 0 || i >= str.length) throw new Error("NumPCarac(): posição fora de alcance.");
	  return str.charCodeAt(i);
	},
	// CaracPNum(num): converte num para caractere (mesma de carac)
	"caracpnum": ([num]) => {
	  if (typeof num !== "number") throw new Error("CaracPNum(): argumento não é número.");
	  return String.fromCharCode(num);
	},
  };
  
  ///////////////////////
  // 5.4) CLASSE PRINCIPAL INTERPRETER
  ///////////////////////
  
  class Interpreter {
	private globals: Environment;   // ambiente global
	private environment: Environment; // ambiente atual (pode mudar em chamadas)
	private functions: Map<string, FuncDecl> = new Map();  // UDFs
	private procedures: Map<string, ProcDecl> = new Map(); // UDFs sem retorno
  
	constructor() {
	  this.globals = new Environment(null);
	  this.environment = this.globals;
  
	  // Aqui podemos pré‐definir eventuais variáveis de sistema, se necessário
	  // Exemplo: Pi = 3.141592653589793
	  // this.globals.define("pi", "real", Math.PI, true);
	}
  
	/**
	 * Inicia a execução de uma lista de nós AST (programa).
	 * Primeiro pass: registra declarações de funções/procedimentos.
	 * Segundo pass: executa declarações de variáveis globais e demais comandos no ambiente global.
	 */
	interpret(nodes: ASTNode[]) {
	  // 1) Registrar todas as declarações de função e procedimento
	  for (const node of nodes) {
		if (node instanceof FuncDecl) {
		  this.functions.set(node.name.toLowerCase(), node);
		} else if (node instanceof ProcDecl) {
		  this.procedures.set(node.name.toLowerCase(), node);
		}
	  }
  
	  // 2) Executar todas as declarações e comandos
	  for (const node of nodes) {
		if (node instanceof VarDecl) {
		  for (const varName of node.names) {
			// Inicializamos variáveis com valor null
			this.environment.define(varName, node.typeName, null, false);
		  }
		} else if (node instanceof ConstDecl) {
		  // Avalia valor e define como readOnly
		  const val = this.evaluate(node.value);
		  this.environment.define(node.name, node.typeName, val, true);
		} else if (
		  node instanceof AssignStmt ||
		  node instanceof WriteStmt ||
		  node instanceof ReadStmt ||
		  node instanceof IfStmt ||
		  node instanceof SwitchCaseStmt ||
		  node instanceof ForStmt ||
		  node instanceof WhileStmt ||
		  node instanceof RepeatStmt ||
		  node instanceof BreakStmt ||
		  node instanceof ReturnStmt ||
		  node instanceof CallStmt ||
		  node instanceof SimpleStmt
		) {
		  this.execute(node);
		}
		// Note: Pulamos FuncDecl e ProcDecl aqui, pois já foram registrados
	  }
	}
  
	/**
	 * Executa um nó de instrução (Stmt). Dependendo do tipo, chama método específico.
	 */
	private execute(stmt: Stmt): void {
	  if (stmt instanceof AssignStmt) {
		this.executeAssign(stmt);
	  } else if (stmt instanceof WriteStmt) {
		this.executeWrite(stmt);
	  } else if (stmt instanceof ReadStmt) {
		this.executeRead(stmt);
	  } else if (stmt instanceof IfStmt) {
		this.executeIf(stmt);
	  } else if (stmt instanceof SwitchCaseStmt) {
		this.executeSwitch(stmt);
	  } else if (stmt instanceof ForStmt) {
		this.executeFor(stmt);
	  } else if (stmt instanceof WhileStmt) {
		this.executeWhile(stmt);
	  } else if (stmt instanceof RepeatStmt) {
		this.executeRepeat(stmt);
	  } else if (stmt instanceof BreakStmt) {
		throw new BreakException();
	  } else if (stmt instanceof ReturnStmt) {
		const val = stmt.value ? this.evaluate(stmt.value) : null;
		throw new ReturnException(val);
	  } else if (stmt instanceof CallStmt) {
		this.executeCall(stmt);
	  } else if (stmt instanceof SimpleStmt) {
		this.executeSimple(stmt);
	  } else {
		throw new Error("Execução de instrução desconhecida.");
	  }
	}
  
	/////////////////////////
	// 5.4.1) Métodos de execução para cada Stmt
	/////////////////////////
  
	/**
	 * Atribuição: x <- expr
	 */
	private executeAssign(stmt: AssignStmt) {
	  const value = this.evaluate(stmt.expr);
	  this.environment.assign(stmt.name, value);
	}
  
	/**
	 * ESCREVA/ESCREVAL: avalia cada expressão e imprime no console.
	 * Usamos console.log para imprimir cada linha (para simplificar).
	 */
	private executeWrite(stmt: WriteStmt) {
	  const outputs: string[] = [];
	  for (const arg of stmt.args) {
		const val = this.evaluate(arg);
		outputs.push(val === null ? "null" : String(val));
	  }
	  // Concatena todos valores num único string
	  const line = outputs.join(" ");
	  if (stmt.newline) {
		console.log(line);
	  } else {
		// imprimir sem quebra de linha: aqui, só fazemos console.log mesmo
		// é impossível em JS/browsers imprimir sem newline sem usar process.stdout
		console.log(line);
	  }
	}
  
	/**
	 * LEIA(varName): lê do teclado (prompt síncrono).
	 * Aqui, usamos prompt-sync. Se não instalado, lança exceção.
	 */
	private executeRead(stmt: ReadStmt) {
	  // Precisamos de input síncrono no terminal. Se não houver, lançamos exceção.
	  let prompt: any;
	  try {
		// @ts-ignore
		prompt = require('prompt-sync')({ sigint: true });
	  } catch {
		throw new Error("Para usar LEIA() é necessário instalar pacote 'prompt-sync'. Ex.: npm install prompt-sync");
	  }
	  const inputStr: string = prompt(`>> `);
	  // Descobre tipo da variável
	  const variable = this.environment.get(stmt.name);
	  // Converte string lida para o tipo correto
	  let parsedValue: ValueType = null;
	  switch (variable.typeName) {
		case "inteiro":
		  parsedValue = parseInt(inputStr, 10);
		  if (isNaN(parsedValue as number)) throw new Error(`Entrada inválida para inteiro: '${inputStr}'.`);
		  break;
		case "real":
		  parsedValue = parseFloat(inputStr);
		  if (isNaN(parsedValue as number)) throw new Error(`Entrada inválida para real: '${inputStr}'.`);
		  break;
		case "logico":
		  const low = inputStr.trim().toLowerCase();
		  if (low === "verdadeiro" || low === "true") parsedValue = true;
		  else if (low === "falso" || low === "false") parsedValue = false;
		  else throw new Error(`Entrada inválida para lógico: '${inputStr}'.`);
		  break;
		case "caractere":
		  if (inputStr.length === 0) throw new Error("Entrada vazia para caractere.");
		  parsedValue = inputStr.charAt(0);
		  break;
		case "literal":
		  parsedValue = inputStr;
		  break;
		default:
		  throw new Error(`Tipo desconhecido em LEIA(): ${variable.typeName}.`);
	  }
	  this.environment.assign(stmt.name, parsedValue);
	}
  
	/**
	 * SE: avalia condição (bool). Se true, executa thenBranch; senão, elseBranch (se existir).
	 */
	private executeIf(stmt: IfStmt) {
	  const cond = this.evaluate(stmt.condition);
	  if (typeof cond !== "boolean") {
		throw new Error("Condição de SE não é lógica.");
	  }
	  if (cond) {
		for (const s of stmt.thenBranch) {
		  this.execute(s);
		}
	  } else if (stmt.elseBranch) {
		for (const s of stmt.elseBranch) {
		  this.execute(s);
		}
	  }
	}
  
	/**
	 * ESCOLHA/CASO: compara variável com cada CASE; se encontrar, executa e retorna.
	 * Caso nenhum CASE corresponda, executa defaultBody se não nulo.
	 */
	private executeSwitch(stmt: SwitchCaseStmt) {
	  const varValue = this.environment.get(stmt.variable).value;
	  let matched = false;
	  for (const c of stmt.cases) {
		const caseVal = this.evaluate(c.value);
		if (this.isEqual(varValue, caseVal)) {
		  // Executa corpo do CASE
		  for (const s of c.body) {
			this.execute(s);
		  }
		  matched = true;
		  break;
		}
	  }
	  if (!matched && stmt.defaultBody) {
		for (const s of stmt.defaultBody) {
		  this.execute(s);
		}
	  }
	}
  
	/**
	 * FOR: loop de variável com início, fim e passo. Passo padrão = 1.
	 * Se passo positivo: enquanto var <= end; se negativo: enquanto var >= end.
	 * A cada iteração, verifica INTERROMPA para break.
	 */
	private executeFor(stmt: ForStmt) {
	  // Avalia início, fim e passo
	  const startValRaw = this.evaluate(stmt.start);
	  const endValRaw = this.evaluate(stmt.end);
	  let stepVal: number = 1;
	  if (stmt.step) {
		const stepRaw = this.evaluate(stmt.step);
		if (typeof stepRaw !== "number") throw new Error("Passo em FOR não é numérico.");
		stepVal = stepRaw;
	  }
	  if (typeof startValRaw !== "number" || typeof endValRaw !== "number") {
		throw new Error("Início ou fim em FOR não é numérico.");
	  }
	  // Define variável de loop no ambiente atual (sobrescreve se já existia)
	  this.environment.define(stmt.varName, "inteiro", Math.trunc(startValRaw), false);
	  const varKey = stmt.varName; // nome original
	  try {
		// Laço controlado manualmente
		if (stepVal > 0) {
		  while ((this.environment.get(varKey).value as number) <= (endValRaw as number)) {
			try {
			  for (const s of stmt.body) {
				this.execute(s);
			  }
			} catch (e) {
			  if (e instanceof BreakException) {
				break; // sai do laço
			  } else {
				throw e; // relança
			  }
			}
			// Incrementa variável
			const currentVal = this.environment.get(varKey).value as number;
			this.environment.assign(varKey, currentVal + stepVal);
		  }
		} else {
		  while ((this.environment.get(varKey).value as number) >= (endValRaw as number)) {
			try {
			  for (const s of stmt.body) {
				this.execute(s);
			  }
			} catch (e) {
			  if (e instanceof BreakException) {
				break;
			  } else {
				throw e;
			  }
			}
			const currentVal = this.environment.get(varKey).value as number;
			this.environment.assign(varKey, currentVal + stepVal);
		  }
		}
	  } finally {
		// Após saída do loop, redefine variável de loop para null
		this.environment.assign(varKey, null);
	  }
	}
  
	/**
	 * ENQUANTO: avalia condição e, enquanto for true, executa corpo.
	 * Usa BreakException para INTERROMPA.
	 */
	private executeWhile(stmt: WhileStmt) {
	  while (true) {
		const condVal = this.evaluate(stmt.condition);
		if (typeof condVal !== "boolean") throw new Error("Condição de ENQUANTO não é lógica.");
		if (!condVal) break;
		try {
		  for (const s of stmt.body) {
			this.execute(s);
		  }
		} catch (e) {
		  if (e instanceof BreakException) {
			break;
		  } else {
			throw e;
		  }
		}
	  }
	}
  
	/**
	 * REPITA ... ATE: executa corpo ao menos uma vez; após cada iteração, avalia cond.
	 * Se cond == true, sai.
	 * Usa BreakException se INTERROMPA estiver dentro do loop (não é típico em REPITA, mas suportado).
	 */
	private executeRepeat(stmt: RepeatStmt) {
	  while (true) {
		try {
		  for (const s of stmt.body) {
			this.execute(s);
		  }
		} catch (e) {
		  if (e instanceof BreakException) {
			break; // sai do laço
		  } else {
			throw e;
		  }
		}
		const condVal = this.evaluate(stmt.condition);
		if (typeof condVal !== "boolean") throw new Error("Condição de ATE em REPITA não é lógica.");
		if (condVal) break;
	  }
	}
  
	/**
	 * Chamada de função / procedimento sem atribuição: ProcDecl ou FuncDecl (descarta retorno).
	 */
	private executeCall(stmt: CallStmt) {
	  const nameKey = stmt.name.toLowerCase();
	  // Se for função builtIn
	  if (builtInFunctions[nameKey]) {
		// Avalia argumentos e chama, mas descarta retorno
		const args = stmt.args.map(arg => this.evaluate(arg));
		builtInFunctions[nameKey](args);
		return;
	  }
	  // Função do usuário
	  if (this.functions.has(nameKey)) {
		this.callFunction(this.functions.get(nameKey)!, stmt.args);
		return;
	  }
	  // Procedimento do usuário
	  if (this.procedures.has(nameKey)) {
		this.callProcedure(this.procedures.get(nameKey)!, stmt.args);
		return;
	  }
	  throw new Error(`Função/Procedimento '${stmt.name}' não declarada.`);
	}
  
	/**
	 * PAUSA (apenas print e espera Enter) ou LIMITELA => console.clear()
	 */
	private executeSimple(stmt: SimpleStmt) {
	  if (stmt.type === TokenType.PAUSA) {
		console.log("[Pressione ENTER para continuar]");
		let prompt: any;
		try {
		  // @ts-ignore
		  prompt = require('prompt-sync')({ sigint: true });
		  prompt("");
		} catch {
		  // Se não tiver prompt-sync, só retorna
		}
	  } else if (stmt.type === TokenType.LIMITELA) {
		console.clear();
	  }
	}
  
	/////////////////////////
	// 5.4.2) Auxiliares de chamada de função e procedimento
	/////////////////////////
  
	/**
	 * Executa uma Função do usuário, criando novo escopo, inicializando parâmetros,
	 * executando corpo até RETORNE e retornando valor (ou erro se sem RETURN).
	 */
	private callFunction(func: FuncDecl, argExprs: Expr[]): ValueType {
	  // Verifica número de argumentos
	  if (argExprs.length !== func.params.length) {
		throw new Error(`Função '${func.name}' chamada com número incorreto de argumentos.`);
	  }
	  // Cria novo ambiente, enclavado ao atual global
	  const previous = this.environment;
	  const localEnv = new Environment(this.globals);
	  this.environment = localEnv;
  
	  // Avalia e define parâmetros no novo escopo
	  for (let i = 0; i < argExprs.length; i++) {
		const param = func.params[i];
		const val = this.evaluate(argExprs[i]);
		this.environment.define(param.name, param.typeName, val, false);
	  }
  
	  let returnValue: ValueType = null;
	  try {
		// Executa cada comando do corpo, até encontrar RETORNE (lança ReturnException)
		for (const s of func.body) {
		  this.execute(s);
		}
		// Se chegou aqui sem RETURN explícito, erro
		throw new Error(`Função '${func.name}' não retornou valor.`);
	  } catch (e: any) {
		if (e instanceof ReturnException) {
		  returnValue = e.value;
		} else {
		  throw e; // erro real
		}
	  } finally {
		// Restaura ambiente anterior
		this.environment = previous;
	  }
	  return returnValue;
	}
  
	/**
	 * Executa um Procedimento do usuário: mesmo processo de callFunction, mas ignora retorno.
	 */
	private callProcedure(proc: ProcDecl, argExprs: Expr[]): void {
	  if (argExprs.length !== proc.params.length) {
		throw new Error(`Procedimento '${proc.name}' chamado com número incorreto de argumentos.`);
	  }
	  const previous = this.environment;
	  const localEnv = new Environment(this.globals);
	  this.environment = localEnv;
  
	  for (let i = 0; i < argExprs.length; i++) {
		const param = proc.params[i];
		const val = this.evaluate(argExprs[i]);
		this.environment.define(param.name, param.typeName, val, false);
	  }
  
	  try {
		for (const s of proc.body) {
		  this.execute(s);
		}
	  } catch (e: any) {
		if (e instanceof ReturnException) {
		  // Procedimento não deve retornar valor; ignorar
		} else {
		  throw e;
		}
	  } finally {
		this.environment = previous;
	  }
	}
  
	/////////////////////////
	// 5.5) Avaliador de Expressões
	/////////////////////////
  
	/**
	 * Avalia calcular resultado de Expr (recursivamente).
	 */
	private evaluate(expr: Expr): ValueType {
	  if (expr instanceof LiteralExpr) {
		return expr.value;
	  }
	  if (expr instanceof VariableExpr) {
		return this.environment.get(expr.name).value;
	  }
	  if (expr instanceof UnaryExpr) {
		const right = this.evaluate(expr.right);
		return this.evaluateUnary(expr.operator, right);
	  }
	  if (expr instanceof BinaryExpr) {
		const leftVal = this.evaluate(expr.left);
		const rightVal = this.evaluate(expr.right);
		return this.evaluateBinary(leftVal, expr.operator, rightVal);
	  }
	  if (expr instanceof FuncCallExpr) {
		// Funções pré‐definidas?
		const nameKey = expr.name.toLowerCase();
		const argVals = expr.args.map(arg => this.evaluate(arg));
		if (builtInFunctions[nameKey]) {
		  return builtInFunctions[nameKey](argVals);
		}
		// Função do usuário
		if (this.functions.has(nameKey)) {
		  return this.callFunction(this.functions.get(nameKey)!, expr.args);
		}
		throw new Error(`Função '${expr.name}' não declarada.`);
	  }
	  if (expr instanceof CastExpr) {
		const raw = this.evaluate(expr.expr);
		// Converte raw para o tipo expr.typeName via environment.castValue (agora público)
		return this.environment.castValue(expr.typeName, raw);
	  }
	  throw new Error("Expressão desconhecida em evaluate().");
	}
  
	/**
	 * Avalia operação unária: NOT e negação numérica.
	 */
	private evaluateUnary(operator: Token, right: ValueType): ValueType {
	  switch (operator.type) {
		case TokenType.NOT:
		  if (typeof right !== "boolean") throw new Error("Operador NOT aplicado a não-lógico.");
		  return !right;
		case TokenType.MINUS:
		  if (typeof right !== "number") throw new Error("Operador unário '-' aplicado a não-numérico.");
		  return -right;
	  }
	  throw new Error(`Operador unário desconhecido: ${operator.lexeme}.`);
	}
  
	/**
	 * Avalia operação binária: aritmética, comparação, lógico.
	 */
	private evaluateBinary(left: ValueType, operator: Token, right: ValueType): ValueType {
	  switch (operator.type) {
		// ARITMÉTICOS
		case TokenType.PLUS:
		  if (typeof left === "number" && typeof right === "number") return left + right;
		  if (typeof left === "string" && typeof right === "string") return left + right;
		  throw new Error("Operador '+' inválido para operandos dados.");
		case TokenType.MINUS:
		  if (typeof left === "number" && typeof right === "number") return left - right;
		  throw new Error("Operador '-' inválido para operandos dados.");
		case TokenType.STAR:
		  if (typeof left === "number" && typeof right === "number") return left * right;
		  throw new Error("Operador '*' inválido para operandos dados.");
		case TokenType.SLASH:
		  if (typeof left === "number" && typeof right === "number") {
			if (right === 0) throw new Error("Divisão por zero.");
			return left / right;
		  }
		  throw new Error("Operador '/' inválido para operandos dados.");
		case TokenType.DIV:
		  if (typeof left === "number" && typeof right === "number") {
			if (right === 0) throw new Error("Divisão por zero.");
			return Math.trunc(left / right);
		  }
		  throw new Error("Operador 'DIV' inválido para operandos dados.");
		case TokenType.MOD:
		case TokenType.PERCENT:
		  if (typeof left === "number" && typeof right === "number") {
			if (right === 0) throw new Error("Módulo por zero.");
			return left % right;
		  }
		  throw new Error("Operador 'MOD' inválido para operandos dados.");
  
		// RELACIONAIS
		case TokenType.GREATER:
		  if (typeof left === "number" && typeof right === "number") return left > right;
		  throw new Error("Operador '>' inválido para operandos dados.");
		case TokenType.GREATER_EQUAL:
		  if (typeof left === "number" && typeof right === "number") return left >= right;
		  throw new Error("Operador '>=' inválido para operandos dados.");
		case TokenType.LESS:
		  if (typeof left === "number" && typeof right === "number") return left < right;
		  throw new Error("Operador '<' inválido para operandos dados.");
		case TokenType.LESS_EQUAL:
		  if (typeof left === "number" && typeof right === "number") return left <= right;
		  throw new Error("Operador '<=' inválido para operandos dados.");
		case TokenType.EQUAL_EQUAL:
		  return this.isEqual(left, right);
		case TokenType.BANG_EQUAL:
		  return !this.isEqual(left, right);
  
		// LÓGICOS
		case TokenType.AND:
		  if (typeof left === "boolean" && typeof right === "boolean") return left && right;
		  throw new Error("Operador 'E' inválido para operandos dados.");
		case TokenType.OR:
		  if (typeof left === "boolean" && typeof right === "boolean") return left || right;
		  throw new Error("Operador 'OU' inválido para operandos dados.");
		case TokenType.XOR:
		  if (typeof left === "boolean" && typeof right === "boolean") return left !== right;
		  throw new Error("Operador 'XOR' inválido para operandos dados.");
	  }
	  throw new Error(`Operador binário desconhecido: ${operator.lexeme}.`);
	}
  
	/**
	 * Compara igualdade de valores (null, number, string, boolean).
	 */
	private isEqual(a: ValueType, b: ValueType): boolean {
	  if (a === null && b === null) return true;
	  if (a === null) return false;
	  return a === b;
	}
  }
  
  ///////////////////////
  // 6) FUNÇÃO AUXILIAR PARA RODAR UM CÓDIGO-FONTE VISUALG
  ///////////////////////
  
  /**
   * runVisualgProgram é a função que unifica Lexer, Parser e Interpreter.
   * Basta chamar runVisualgProgram(códigoEmString).
   */
  export function runVisualgProgram(source: string) {
	try {
	  // 1) Tokenização
	  const lexer = new Lexer(source);
	  const tokens = lexer.scanTokens();
  
	  // 2) Parsing
	  const parser = new Parser(tokens);
	  const nodes = parser.parse();
  
	  // 3) Interpretação
	  const interpreter = new Interpreter();
	  interpreter.interpret(nodes);
	} catch (e: any) {
	  console.error(`Erro em execução: ${e.message}`);
	}
  }
  