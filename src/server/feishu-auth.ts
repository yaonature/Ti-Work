/**
 * 飞书开放平台鉴权工具 —— 用于「飞书自建应用」授权验证。
 *
 * 主流程：用企业自建应用的 App ID + App Secret 换取 tenant_access_token（应用身份令牌），
 * 以校验凭据是否正确、凭据是否有权限访问开放平台。此模块只负责与飞书开放平台交互，
 * 不做任何配置持久化（持久化见 integrations.ts）。
 *
 * 参考飞书接口：POST /open-apis/auth/v3/tenant_access_token/internal
 * 成功返回 code=0 与 tenant_access_token（前缀 t-）；失败返回非零 code 与 msg。
 */
const FEISHU_TENANT_TOKEN_URL =
  'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal'

const VERIFY_TIMEOUT_MS = 8000

export interface FeishuVerifyInput {
  appId: string
  appSecret: string
}

export interface FeishuVerifyResult {
  ok: boolean
  message: string
  code?: number
  tenantAccessToken?: string
  expire?: number
}

/**
 * 校验飞书自建应用凭据：用 app_id + app_secret 换取 tenant_access_token。
 * 网络异常或响应非 JSON 均视为失败并返回可读的 message。
 */
export async function verifyFeishuAppToken(
  input: FeishuVerifyInput,
): Promise<FeishuVerifyResult> {
  try {
    const res = await fetch(FEISHU_TENANT_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: input.appId,
        app_secret: input.appSecret,
      }),
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    })
    const data = (await res.json()) as {
      code?: number
      msg?: string
      tenant_access_token?: string
      expire?: number
    }
    if (data.code === 0 && data.tenant_access_token) {
      return {
        ok: true,
        message: data.msg || 'ok',
        code: 0,
        tenantAccessToken: data.tenant_access_token,
        expire: data.expire,
      }
    }
    return {
      ok: false,
      message: data.msg || `飞书返回错误码 ${data.code ?? '未知'}`,
      code: data.code,
    }
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : '无法连接飞书开放平台，请检查网络',
    }
  }
}
