import { CancellationError } from "./Errors";
import { logger } from "./Logger";
import { Utility } from "./Utilities";

export class Engine {
    private static readonly MAX_ATTEMPTS: number = 4;
    private static readonly BASE_RETRY_DELAY_MS: number = 2000;

    public static async Task<T>(step: () => Promise<T>, stepName?: string): Promise<T> {
        const name = stepName || "Unnamed step";

        for (let attempt = 1; attempt <= Engine.MAX_ATTEMPTS; attempt++) {
            if (Utility.didUserCancel()) {
                throw new CancellationError();
            }

            const attemptText = attempt === 1
                ? ""
                : ` attempt ${attempt}/${Engine.MAX_ATTEMPTS}`;

            logger.logVerbose(`Begin step '${name}'${attemptText}.`);

            try {
                const ret: T = await step();
                logger.logVerbose(`Finished step '${name}'${attemptText}.`);
                return ret;
            } catch (error) {
                const retryable = attempt < Engine.MAX_ATTEMPTS && Engine.isRetryableConnectionError(error);

                if (!retryable) {
                    throw error;
                }

                const delayMs = Engine.BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1);

                logger.logWarning(
                    `Transient connection error in step '${name}'. ` +
                    `Retrying in ${delayMs} ms. ` +
                    `Attempt ${attempt + 1}/${Engine.MAX_ATTEMPTS}. ` +
                    `Error: ${Engine.formatError(error)}`
                );

                await Engine.sleep(delayMs);
            }
        }

        throw new Error(`Retry loop exited unexpectedly for step '${name}'.`);
    }

    private static sleep(milliseconds: number): Promise<void> {
        return new Promise<void>(resolve => setTimeout(resolve, milliseconds));
    }

    private static isRetryableConnectionError(error: any): boolean {
        if (!error) {
            return false;
        }

        /*
         * Do not retry Azure DevOps application errors.
         * Those normally have an HTTP response/status and should fail normally.
         */
        if (error.statusCode || error.status || error.response || error.responseBody || error.result) {
            return false;
        }

        const message = Engine.formatError(error).toLowerCase();

        /*
         * This matches your real failure:
         * connect ETIMEDOUT 150.171.74.16:443
         *
         * This is a TCP connect timeout before Azure DevOps returns an HTTP response.
         */
        return message.indexOf("connect etimedout") >= 0;
    }

    private static formatError(error: any): string {
        if (!error) {
            return "unknown error";
        }

        if (error.message) {
            return error.message;
        }

        try {
            return JSON.stringify(error);
        } catch (stringifyError) {
            return error.toString();
        }
    }
}
