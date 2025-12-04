export interface RpcParam {
  name: string;
  type: string;
  required: boolean;
  description: string;
  schema?: any;
}

export interface RpcError {
  code: number;
  message: string;
  description?: string;
}

export interface RpcMethod {
  name: string;
  category: string;
  summary: string;
  description: string;
  params: RpcParam[];
  result: {
    type: string;
    description: string;
    schema: any;
  };
  errors?: RpcError[];
  examples?: {
    name: string;
    params: any;
    result: any;
  }[];
}

export enum ProgrammingLanguage {
  JavaScript = 'JavaScript',
  Python = 'Python',
  Go = 'Go',
  Curl = 'cURL'
}

export interface AIResponse {
  text: string;
  loading: boolean;
  error?: string;
}