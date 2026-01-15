/**
 * Image generation provider interface
 */

interface ImageGenerateOptions {
    model: string;
    prompt: string;
    size?: string;
    quality?: 'standard' | 'hd';
    style?: 'vivid' | 'natural';
    n?: number;
    response_format?: 'url' | 'b64_json';
}
interface ImageEditOptions {
    model: string;
    image: Buffer | string;
    prompt: string;
    mask?: Buffer | string;
    size?: string;
    n?: number;
    response_format?: 'url' | 'b64_json';
}
interface ImageVariationOptions {
    model: string;
    image: Buffer | string;
    n?: number;
    size?: string;
    response_format?: 'url' | 'b64_json';
}
interface ImageResponse {
    created: number;
    data: Array<{
        url?: string;
        b64_json?: string;
        revised_prompt?: string;
    }>;
}

export type { ImageEditOptions, ImageGenerateOptions, ImageResponse, ImageVariationOptions };
