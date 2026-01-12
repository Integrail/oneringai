# Microsoft Graph Setup for Interactive Chat

Quick guide to enable Microsoft Graph in the interactive chat.

## What Was Added

✅ Microsoft Graph OAuth integration (Client Credentials flow)
✅ `microsoft_graph` tool for the AI agent
✅ `/msgraph` command to show Graph API info
✅ Automatic registration if credentials are in `.env`

## Setup Instructions

### 1. Create Azure AD App Registration

**A. Go to Azure Portal**:
- Visit https://portal.azure.com
- Navigate to **Azure Active Directory** → **App registrations**
- Click **New registration**

**B. Configure App**:
- **Name**: `OneRing AI Chat` (or any name)
- **Supported account types**: Single tenant (or multi-tenant if needed)
- **Redirect URI**: Leave blank (not needed for Client Credentials)
- Click **Register**

**C. Get Application (Client) ID**:
- On the Overview page, copy the **Application (client) ID**
- Also note the **Directory (tenant) ID**

**D. Create Client Secret**:
- Go to **Certificates & secrets** → **Client secrets**
- Click **New client secret**
- Description: `OneRing AI Chat Secret`
- Expires: Choose duration (24 months recommended)
- Click **Add**
- **IMPORTANT**: Copy the secret **Value** immediately (you can't see it again!)

**E. Grant API Permissions**:
- Go to **API permissions**
- Click **Add a permission** → **Microsoft Graph** → **Application permissions**
- Add these permissions:
  - `User.Read.All` - Read all users in directory
  - `Mail.Read` - Read mail in all mailboxes
  - `Calendars.Read` - Read calendars in all mailboxes
  - `Files.Read.All` - Read all files
  - `Directory.Read.All` - Read directory data
- Click **Grant admin consent for [Your Organization]** (requires admin role!)
- Wait for status to show "Granted"

### 2. Add to Environment Variables

Edit your `.env` file:

```bash
# Microsoft Graph API
MICROSOFT_CLIENT_ID=12345678-1234-1234-1234-123456789012
MICROSOFT_CLIENT_SECRET=abC~1234567890abcdefghijklmnopqrst
MICROSOFT_TENANT_ID=87654321-4321-4321-4321-210987654321
```

**Where to find these**:
- **CLIENT_ID**: App registration → Overview → Application (client) ID
- **CLIENT_SECRET**: The secret value you copied (not the secret ID!)
- **TENANT_ID**: App registration → Overview → Directory (tenant) ID

### 3. Test the Chat

```bash
npm run example:chat
```

**You should see**:
```
Provider: OpenAI (or your selected provider)
Model: gpt-4o
Vision: ✅ Enabled
Microsoft Graph: ✅ Available (access M365 data)  ← NEW!

Commands:
  /msgraph  - Show Microsoft Graph info  ← NEW!
```

### 4. Try Microsoft Graph Queries

**Example queries to try**:

```
You: How many users are in my organization?
```
→ Agent calls: `microsoft_graph({ endpoint: "/v1.0/users", method: "GET" })`

```
You: List the first 5 users
```
→ Agent calls: `microsoft_graph({ endpoint: "/v1.0/users?$top=5", method: "GET" })`

```
You: Show me user details for users whose name starts with A
```
→ Agent calls: `microsoft_graph({ endpoint: "/v1.0/users?$filter=startswith(displayName,'A')", method: "GET" })`

```
You: What groups exist in my organization?
```
→ Agent calls: `microsoft_graph({ endpoint: "/v1.0/groups", method: "GET" })`

### 5. Use `/msgraph` Command

Type `/msgraph` in the chat to see:
- Microsoft Graph status
- Available endpoints
- Example queries
- Auth type (Client Credentials)

## What the AI Can Do

With Microsoft Graph configured, the AI can:

✅ **List users** - Get all users in your organization
✅ **Read emails** - Access mailboxes (with Mail.Read permission)
✅ **Calendar events** - View calendars (with Calendars.Read permission)
✅ **OneDrive files** - List and read files (with Files.Read.All permission)
✅ **Teams data** - Access teams and channels
✅ **Directory info** - Query Azure AD

## Troubleshooting

### "Microsoft Graph not configured"

**Check**:
1. All three environment variables are set in `.env`
2. Restart the chat after adding credentials
3. Check for typos in environment variable names

### "Token request failed: 401 Unauthorized"

**Causes**:
- Wrong client ID or secret
- Wrong tenant ID
- Client secret expired

**Fix**:
- Double-check credentials from Azure Portal
- Generate a new client secret if expired

### "Insufficient privileges"

**Causes**:
- Permissions not granted
- Admin consent not clicked
- Trying to access data beyond granted permissions

**Fix**:
1. Go to Azure Portal → Your App → API permissions
2. Check permissions are added
3. Click "Grant admin consent"
4. Wait for "Granted" status

### "Microsoft Graph API error: 403 Forbidden"

**Causes**:
- Missing specific permission for the endpoint
- Admin consent not granted

**Fix**:
- Add required permission in Azure Portal
- Grant admin consent
- Wait a few minutes for permissions to propagate

## Security Notes

⚠️ **Client Credentials Flow** means:
- The app acts on behalf of itself, not a specific user
- Can access organization-wide data
- Requires admin consent
- Keep client secret secure (never commit to git!)

✅ **Tokens are encrypted**:
- Stored in memory (default)
- Can use FileStorage for persistence
- AES-256-GCM encryption

## Advanced: Use Different Permissions

To access different data, add more permissions:

**Email (specific user)**:
- `Mail.ReadWrite` - Read/write mail
- `Mail.Send` - Send mail

**Calendar**:
- `Calendars.ReadWrite` - Read/write calendars

**Files**:
- `Files.ReadWrite.All` - Read/write all files
- `Sites.ReadWrite.All` - SharePoint sites

**After adding**:
1. Grant admin consent
2. Restart chat
3. AI can now access that data!

---

**Ready to use!** Type queries about your Microsoft 365 data in the chat. 🔷💬
