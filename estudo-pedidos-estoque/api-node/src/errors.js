// Erro com status HTTP. O middleware de erros do app.js transforma isso em resposta JSON.
export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }
}
