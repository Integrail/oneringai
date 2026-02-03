/**
 * MCPServersPage - Main hub for managing MCP servers
 *
 * Displays all configured MCP servers with ability to add, edit, delete, connect, and view tools.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Button, Modal, Form, Alert } from 'react-bootstrap';
import { Plus, Server, Wrench, Library } from 'lucide-react';
import { PageHeader } from '../components/layout';
import { MCPServerCard, MCPServerToolList, TransportConfigForm, MCPTemplateSelector, TemplateRequiredFields } from '../components/mcp';
import type { StoredMCPServerConfig } from '../components/mcp';
import type { TransportType, TransportConfig } from '../components/mcp/TransportConfigForm';
import type { MCPServerTemplate } from '../../shared/mcpTemplates';
import { useNavigation } from '../hooks/useNavigation';

interface MCPTool {
  name: string;
  description?: string;
}

export function MCPServersPage(): React.ReactElement {
  const { navigate } = useNavigation();

  const [servers, setServers] = useState<StoredMCPServerConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingServer, setEditingServer] = useState<StoredMCPServerConfig | null>(null);
  const [editName, setEditName] = useState('');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editTransport, setEditTransport] = useState<TransportType>('stdio');
  const [editTransportConfig, setEditTransportConfig] = useState<TransportConfig>({});
  const [editToolNamespace, setEditToolNamespace] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isCreateMode, setIsCreateMode] = useState(false);

  // Delete confirmation state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingServer, setDeletingServer] = useState<StoredMCPServerConfig | null>(null);

  // Tools modal state
  const [showToolsModal, setShowToolsModal] = useState(false);
  const [viewingServer, setViewingServer] = useState<StoredMCPServerConfig | null>(null);
  const [serverTools, setServerTools] = useState<MCPTool[]>([]);
  const [loadingTools, setLoadingTools] = useState(false);

  // Template selector state
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<MCPServerTemplate | null>(null);

  // Load servers
  const loadServers = useCallback(async () => {
    try {
      const serverList = await window.hosea.mcpServer.list();
      setServers(serverList);
    } catch (error) {
      console.error('Failed to load MCP servers:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadServers();
  }, [loadServers]);

  // Handlers
  const handleAddServer = () => {
    setIsCreateMode(true);
    setEditingServer(null);
    setSelectedTemplate(null);
    setEditName('');
    setEditDisplayName('');
    setEditDescription('');
    setEditTransport('stdio');
    setEditTransportConfig({});
    setEditToolNamespace('');
    setEditError(null);
    setShowEditModal(true);
  };

  const handleBrowseTemplates = () => {
    setShowTemplateSelector(true);
  };

  const handleSelectTemplate = (template: MCPServerTemplate) => {
    setShowTemplateSelector(false);
    setSelectedTemplate(template);
    setIsCreateMode(true);
    setEditingServer(null);

    // Pre-fill form with template data
    setEditName(template.name);
    setEditDisplayName(template.displayName);
    setEditDescription(template.description);
    setEditTransport(template.transport);

    // Build initial transport config
    // For args with placeholders, keep them as placeholders for now
    // The user will fill them in via the form
    const config: TransportConfig = {};
    if (template.transportConfig.command) {
      config.command = template.transportConfig.command;
    }
    if (template.transportConfig.args) {
      config.args = [...template.transportConfig.args];
    }
    if (template.transportConfig.url) {
      config.url = template.transportConfig.url;
    }

    // Pre-populate env object with required env keys (empty values)
    if (template.requiredEnv && template.requiredEnv.length > 0) {
      config.env = {};
      for (const envField of template.requiredEnv) {
        config.env[envField.key] = '';
      }
    }

    setEditTransportConfig(config);
    setEditToolNamespace('');
    setEditError(null);
    setShowEditModal(true);
  };

  const handleEditServer = (server: StoredMCPServerConfig) => {
    setIsCreateMode(false);
    setEditingServer(server);
    setSelectedTemplate(null); // Clear template when editing existing server
    setEditName(server.name);
    setEditDisplayName(server.displayName || '');
    setEditDescription(server.description || '');
    setEditTransport(server.transport);
    setEditTransportConfig({ ...server.transportConfig });
    setEditToolNamespace(server.toolNamespace || '');
    setEditError(null);
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    // Validation
    if (!editName.trim()) {
      setEditError('Server name is required');
      return;
    }

    if (editTransport === 'stdio' && !editTransportConfig.command?.trim()) {
      setEditError('Command is required for stdio transport');
      return;
    }

    if ((editTransport === 'http' || editTransport === 'https') && !editTransportConfig.url?.trim()) {
      setEditError('URL is required for HTTP transport');
      return;
    }

    // Validate template required fields when creating from template
    if (selectedTemplate && isCreateMode) {
      // Check required env vars
      if (selectedTemplate.requiredEnv) {
        for (const envField of selectedTemplate.requiredEnv) {
          if (envField.required && !editTransportConfig.env?.[envField.key]?.trim()) {
            setEditError(`${envField.label} is required`);
            return;
          }
        }
      }

      // Check required args (ensure placeholders are replaced)
      if (selectedTemplate.requiredArgs) {
        for (const argField of selectedTemplate.requiredArgs) {
          if (argField.required) {
            const idx = selectedTemplate.transportConfig.args?.indexOf(argField.key);
            if (idx !== undefined && idx >= 0) {
              const argValue = editTransportConfig.args?.[idx];
              // Check if still a placeholder or empty
              if (!argValue || argValue === argField.key || argValue.startsWith('{')) {
                setEditError(`${argField.label} is required`);
                return;
              }
            }
          }
        }
      }
    }

    setSaving(true);
    setEditError(null);

    try {
      if (isCreateMode) {
        const result = await window.hosea.mcpServer.create({
          name: editName.trim(),
          displayName: editDisplayName.trim() || undefined,
          description: editDescription.trim() || undefined,
          transport: editTransport,
          transportConfig: editTransportConfig,
          toolNamespace: editToolNamespace.trim() || undefined,
        });

        if (result.success) {
          setShowEditModal(false);
          await loadServers();
        } else {
          setEditError(result.error || 'Failed to create server');
        }
      } else {
        const result = await window.hosea.mcpServer.update(editingServer!.name, {
          displayName: editDisplayName.trim() || undefined,
          description: editDescription.trim() || undefined,
          transport: editTransport,
          transportConfig: editTransportConfig,
          toolNamespace: editToolNamespace.trim() || undefined,
        });

        if (result.success) {
          setShowEditModal(false);
          setEditingServer(null);
          await loadServers();
        } else {
          setEditError(result.error || 'Failed to update server');
        }
      }
    } catch (error) {
      setEditError(String(error));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteServer = (server: StoredMCPServerConfig) => {
    setDeletingServer(server);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingServer) return;

    try {
      const result = await window.hosea.mcpServer.delete(deletingServer.name);
      if (result.success) {
        setShowDeleteModal(false);
        setDeletingServer(null);
        await loadServers();
      } else {
        alert(result.error || 'Failed to delete server');
      }
    } catch (error) {
      alert(String(error));
    }
  };

  const handleConnectServer = async (server: StoredMCPServerConfig) => {
    setActionInProgress(server.name);
    try {
      const result = await window.hosea.mcpServer.connect(server.name);
      if (!result.success) {
        alert(`Failed to connect: ${result.error}`);
      }
      await loadServers();
    } catch (error) {
      alert(`Failed to connect: ${error}`);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDisconnectServer = async (server: StoredMCPServerConfig) => {
    setActionInProgress(server.name);
    try {
      const result = await window.hosea.mcpServer.disconnect(server.name);
      if (!result.success) {
        alert(`Failed to disconnect: ${result.error}`);
      }
      await loadServers();
    } catch (error) {
      alert(`Failed to disconnect: ${error}`);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleRefreshTools = async (server: StoredMCPServerConfig) => {
    setActionInProgress(server.name);
    try {
      const result = await window.hosea.mcpServer.refreshTools(server.name);
      if (!result.success) {
        alert(`Failed to refresh tools: ${result.error}`);
      }
      await loadServers();
    } catch (error) {
      alert(`Failed to refresh tools: ${error}`);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleViewTools = async (server: StoredMCPServerConfig) => {
    setViewingServer(server);
    setLoadingTools(true);
    setShowToolsModal(true);

    try {
      const tools = await window.hosea.mcpServer.getTools(server.name);
      setServerTools(tools);
    } catch (error) {
      console.error('Failed to load tools:', error);
      setServerTools([]);
    } finally {
      setLoadingTools(false);
    }
  };

  if (loading) {
    return (
      <div className="page">
        <PageHeader title="MCP Servers" subtitle="Loading..." />
        <div className="page__content">
          <div className="text-center py-5">
            <div className="spinner-border" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page mcp-servers-page">
      <PageHeader
        title="MCP Servers"
        subtitle={`${servers.length} server${servers.length !== 1 ? 's' : ''} configured`}
      >
        <Button variant="outline-primary" onClick={handleBrowseTemplates} className="me-2">
          <Library size={16} className="me-2" />
          Browse Templates
        </Button>
        <Button variant="primary" onClick={handleAddServer}>
          <Plus size={16} className="me-2" />
          Add Server
        </Button>
      </PageHeader>

      <div className="page__content">
        {servers.length === 0 ? (
          <div className="mcp-servers-page__empty">
            <Server size={64} className="mcp-servers-page__empty-icon" />
            <h3 className="mcp-servers-page__empty-title">No MCP servers configured</h3>
            <p className="mcp-servers-page__empty-text">
              MCP (Model Context Protocol) servers provide additional tools and capabilities for your agents.
              Add a server to extend your agent's functionality.
            </p>
            <div className="mcp-servers-page__empty-actions">
              <Button variant="primary" onClick={handleBrowseTemplates}>
                <Library size={16} className="me-2" />
                Browse Templates
              </Button>
              <Button variant="outline-secondary" onClick={handleAddServer}>
                <Plus size={16} className="me-2" />
                Add Manually
              </Button>
            </div>
          </div>
        ) : (
          <div className="mcp-servers-page__grid">
            {servers.map((server) => (
              <MCPServerCard
                key={server.name}
                server={server}
                onEdit={() => handleEditServer(server)}
                onDelete={() => handleDeleteServer(server)}
                onConnect={() => handleConnectServer(server)}
                onDisconnect={() => handleDisconnectServer(server)}
                onRefreshTools={() => handleRefreshTools(server)}
                onViewTools={() => handleViewTools(server)}
                loading={actionInProgress === server.name}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal show={showEditModal} onHide={() => setShowEditModal(false)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title className="d-flex align-items-center gap-2">
            <Server size={20} />
            {isCreateMode ? 'Add MCP Server' : `Edit ${editingServer?.displayName || editingServer?.name}`}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {editError && <Alert variant="danger" dismissible onClose={() => setEditError(null)}>{editError}</Alert>}

          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Server Name *</Form.Label>
              <Form.Control
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                disabled={!isCreateMode}
                placeholder="e.g., filesystem, github-tools"
              />
              <Form.Text className="text-muted">
                {isCreateMode
                  ? 'Unique identifier for this server (no spaces)'
                  : 'Server name cannot be changed'}
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Display Name</Form.Label>
              <Form.Control
                type="text"
                value={editDisplayName}
                onChange={(e) => setEditDisplayName(e.target.value)}
                placeholder="Optional friendly name"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="What does this server do?"
              />
            </Form.Group>

            <hr />

            {/* Template Required Fields (shown when using a template) */}
            {selectedTemplate && isCreateMode && (
              <>
                <TemplateRequiredFields
                  template={selectedTemplate}
                  config={editTransportConfig}
                  onConfigChange={setEditTransportConfig}
                  disabled={saving}
                />
                <hr />
              </>
            )}

            <TransportConfigForm
              transport={editTransport}
              config={editTransportConfig}
              onTransportChange={setEditTransport}
              onConfigChange={setEditTransportConfig}
              disabled={saving}
            />

            <hr />

            <Form.Group className="mb-3">
              <Form.Label>Tool Namespace</Form.Label>
              <Form.Control
                type="text"
                value={editToolNamespace}
                onChange={(e) => setEditToolNamespace(e.target.value)}
                placeholder={`mcp:${editName || 'server-name'}`}
              />
              <Form.Text className="text-muted">
                Optional prefix for tool names (default: mcp:server-name)
              </Form.Text>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowEditModal(false)} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSaveEdit} disabled={saving}>
            {saving ? 'Saving...' : isCreateMode ? 'Create Server' : 'Save Changes'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Delete MCP Server</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Are you sure you want to delete <strong>{deletingServer?.displayName || deletingServer?.name}</strong>?
          </p>
          <p className="text-muted mb-0">
            This will disconnect the server and remove it from your configuration. Any agents using tools from this server will need to be updated.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleConfirmDelete}>
            Delete
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Tools Modal */}
      <Modal show={showToolsModal} onHide={() => setShowToolsModal(false)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title className="d-flex align-items-center gap-2">
            <Wrench size={20} />
            Tools from {viewingServer?.displayName || viewingServer?.name}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          <MCPServerToolList
            tools={serverTools}
            loading={loadingTools}
            serverName={viewingServer?.name}
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowToolsModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Template Selector Modal */}
      <MCPTemplateSelector
        show={showTemplateSelector}
        onHide={() => setShowTemplateSelector(false)}
        onSelect={handleSelectTemplate}
      />
    </div>
  );
}

export default MCPServersPage;
