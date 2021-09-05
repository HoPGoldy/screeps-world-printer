/**
 * 获取命令执行时传入的参数
 */
export const getArgs = function (): { [argName: string]: string } {
    return Object.fromEntries(
        process.argv
            .filter(arg => arg.startsWith('--'))
            .map(arg => arg.replace('--', ''))
            .map(arg => arg.split('='))
    );
}