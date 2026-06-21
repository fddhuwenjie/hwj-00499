const { loadSpec, generateSummary, getSchemaProperties, resolveRef } = require('./parser');

const CHANGE_TYPE = {
  ADDED: 'added',
  REMOVED: 'removed',
  MODIFIED: 'modified'
};

const CHANGE_CATEGORY = {
  ENDPOINT: 'endpoint',
  PARAMETER: 'parameter',
  REQUEST_BODY: 'requestBody',
  RESPONSE: 'response',
  STATUS_CODE: 'statusCode',
  SCHEMA: 'schema',
  SCHEMA_PROPERTY: 'schemaProperty',
  SECURITY: 'security',
  INFO: 'info'
};

function endpointKey(path, method) {
  return `${method.toUpperCase()} ${path}`;
}

function buildEndpointMap(endpoints) {
  const map = {};
  for (const ep of endpoints) {
    map[endpointKey(ep.path, ep.method)] = ep;
  }
  return map;
}

function compareSchemas(oldSchema, newSchema, oldSpec, newSpec, path = '') {
  const changes = [];

  const oldProps = getSchemaProperties(oldSpec, oldSchema);
  const newProps = getSchemaProperties(newSpec, newSchema);

  const oldPropNames = Object.keys(oldProps.properties || {});
  const newPropNames = Object.keys(newProps.properties || {});

  const allPropNames = new Set([...oldPropNames, ...newPropNames]);

  for (const propName of allPropNames) {
    const propPath = path ? `${path}.${propName}` : propName;
    const oldProp = oldProps.properties[propName];
    const newProp = newProps.properties[propName];

    if (!oldProp && newProp) {
      const isRequired = newProps.required.includes(propName);
      changes.push({
        type: CHANGE_TYPE.ADDED,
        category: CHANGE_CATEGORY.SCHEMA_PROPERTY,
        path: propPath,
        property: propName,
        required: isRequired,
        newSchema: newProp,
        description: `新增字段 '${propName}'${isRequired ? '（必填）' : '（可选）'}`
      });
    } else if (oldProp && !newProp) {
      const wasRequired = oldProps.required.includes(propName);
      changes.push({
        type: CHANGE_TYPE.REMOVED,
        category: CHANGE_CATEGORY.SCHEMA_PROPERTY,
        path: propPath,
        property: propName,
        required: wasRequired,
        oldSchema: oldProp,
        description: `删除字段 '${propName}'${wasRequired ? '（原必填）' : ''}`
      });
    } else {
      const oldType = oldProp.type;
      const newType = newProp.type;
      if (oldType !== newType) {
        changes.push({
          type: CHANGE_TYPE.MODIFIED,
          category: CHANGE_CATEGORY.SCHEMA_PROPERTY,
          path: propPath,
          property: propName,
          field: 'type',
          oldValue: oldType,
          newValue: newType,
          description: `字段 '${propName}' 类型变更: ${oldType} → ${newType}`
        });
      }

      const oldRequired = oldProps.required.includes(propName);
      const newRequired = newProps.required.includes(propName);
      if (oldRequired !== newRequired) {
        changes.push({
          type: CHANGE_TYPE.MODIFIED,
          category: CHANGE_CATEGORY.SCHEMA_PROPERTY,
          path: propPath,
          property: propName,
          field: 'required',
          oldValue: oldRequired,
          newValue: newRequired,
          description: `字段 '${propName}' 必填性变更: ${oldRequired ? '必填' : '可选'} → ${newRequired ? '必填' : '可选'}`
        });
      }

      const oldDesc = oldProp.description || '';
      const newDesc = newProp.description || '';
      if (oldDesc !== newDesc) {
        changes.push({
          type: CHANGE_TYPE.MODIFIED,
          category: CHANGE_CATEGORY.SCHEMA_PROPERTY,
          path: propPath,
          property: propName,
          field: 'description',
          oldValue: oldDesc,
          newValue: newDesc,
          description: `字段 '${propName}' 描述变更`,
          infoOnly: true
        });
      }
    }
  }

  return changes;
}

function compareParameters(oldParams, newParams) {
  const changes = [];
  const oldMap = {};
  const newMap = {};

  for (const p of oldParams) {
    oldMap[`${p.in}:${p.name}`] = p;
  }
  for (const p of newParams) {
    newMap[`${p.in}:${p.name}`] = p;
  }

  const allKeys = new Set([...Object.keys(oldMap), ...Object.keys(newMap)]);

  for (const key of allKeys) {
    const oldParam = oldMap[key];
    const newParam = newMap[key];

    if (!oldParam && newParam) {
      changes.push({
        type: CHANGE_TYPE.ADDED,
        category: CHANGE_CATEGORY.PARAMETER,
        parameter: newParam,
        description: `新增${newParam.in}参数 '${newParam.name}'${newParam.required ? '（必填）' : '（可选）'}`
      });
    } else if (oldParam && !newParam) {
      changes.push({
        type: CHANGE_TYPE.REMOVED,
        category: CHANGE_CATEGORY.PARAMETER,
        parameter: oldParam,
        description: `删除${oldParam.in}参数 '${oldParam.name}'${oldParam.required ? '（原必填）' : ''}`
      });
    } else {
      if (oldParam.required !== newParam.required) {
        changes.push({
          type: CHANGE_TYPE.MODIFIED,
          category: CHANGE_CATEGORY.PARAMETER,
          parameter: newParam,
          field: 'required',
          oldValue: oldParam.required,
          newValue: newParam.required,
          description: `参数 '${newParam.name}' 必填性变更: ${oldParam.required ? '必填' : '可选'} → ${newParam.required ? '必填' : '可选'}`
        });
      }

      const oldType = oldParam.schema ? oldParam.schema.type : undefined;
      const newType = newParam.schema ? newParam.schema.type : undefined;
      if (oldType !== newType) {
        changes.push({
          type: CHANGE_TYPE.MODIFIED,
          category: CHANGE_CATEGORY.PARAMETER,
          parameter: newParam,
          field: 'type',
          oldValue: oldType,
          newValue: newType,
          description: `参数 '${newParam.name}' 类型变更: ${oldType} → ${newType}`
        });
      }

      const oldDesc = oldParam.description || '';
      const newDesc = newParam.description || '';
      if (oldDesc !== newDesc) {
        changes.push({
          type: CHANGE_TYPE.MODIFIED,
          category: CHANGE_CATEGORY.PARAMETER,
          parameter: newParam,
          field: 'description',
          oldValue: oldDesc,
          newValue: newDesc,
          description: `参数 '${newParam.name}' 描述变更`,
          infoOnly: true
        });
      }
    }
  }

  return changes;
}

function compareEndpoints(oldSummary, newSummary, oldSpec, newSpec) {
  const changes = [];

  const oldEndpoints = buildEndpointMap(oldSummary.endpoints);
  const newEndpoints = buildEndpointMap(newSummary.endpoints);

  const allKeys = new Set([...Object.keys(oldEndpoints), ...Object.keys(newEndpoints)]);

  for (const key of allKeys) {
    const oldEp = oldEndpoints[key];
    const newEp = newEndpoints[key];

    if (!oldEp && newEp) {
      changes.push({
        type: CHANGE_TYPE.ADDED,
        category: CHANGE_CATEGORY.ENDPOINT,
        path: newEp.path,
        method: newEp.method,
        endpoint: newEp,
        description: `新增接口 ${newEp.method} ${newEp.path}`
      });
    } else if (oldEp && !newEp) {
      changes.push({
        type: CHANGE_TYPE.REMOVED,
        category: CHANGE_CATEGORY.ENDPOINT,
        path: oldEp.path,
        method: oldEp.method,
        endpoint: oldEp,
        description: `删除接口 ${oldEp.method} ${oldEp.path}`
      });
    } else {
      const paramChanges = compareParameters(oldEp.parameters, newEp.parameters);
      for (const pc of paramChanges) {
        pc.path = newEp.path;
        pc.method = newEp.method;
        changes.push(pc);
      }

      if (oldEp.requestBody || newEp.requestBody) {
        if (oldEp.requestBody && !newEp.requestBody) {
          changes.push({
            type: CHANGE_TYPE.REMOVED,
            category: CHANGE_CATEGORY.REQUEST_BODY,
            path: newEp.path,
            method: newEp.method,
            description: `删除请求体`
          });
        } else if (!oldEp.requestBody && newEp.requestBody) {
          changes.push({
            type: CHANGE_TYPE.ADDED,
            category: CHANGE_CATEGORY.REQUEST_BODY,
            path: newEp.path,
            method: newEp.method,
            description: `新增请求体${newEp.requestBody.required ? '（必填）' : '（可选）'}`
          });
        } else {
          if (oldEp.requestBody.required !== newEp.requestBody.required) {
            changes.push({
              type: CHANGE_TYPE.MODIFIED,
              category: CHANGE_CATEGORY.REQUEST_BODY,
              path: newEp.path,
              method: newEp.method,
              field: 'required',
              oldValue: oldEp.requestBody.required,
              newValue: newEp.requestBody.required,
              description: `请求体必填性变更: ${oldEp.requestBody.required ? '必填' : '可选'} → ${newEp.requestBody.required ? '必填' : '可选'}`
            });
          }

          const bodyChanges = compareSchemas(
            oldEp.requestBody.schema,
            newEp.requestBody.schema,
            oldSpec,
            newSpec,
            'requestBody'
          );
          for (const bc of bodyChanges) {
            bc.path = newEp.path;
            bc.method = newEp.method;
            bc.category = CHANGE_CATEGORY.REQUEST_BODY;
            changes.push(bc);
          }
        }
      }

      const oldStatusCodes = Object.keys(oldEp.responses || {});
      const newStatusCodes = Object.keys(newEp.responses || {});
      const allStatusCodes = new Set([...oldStatusCodes, ...newStatusCodes]);

      for (const sc of allStatusCodes) {
        const oldResp = oldEp.responses[sc];
        const newResp = newEp.responses[sc];

        if (!oldResp && newResp) {
          changes.push({
            type: CHANGE_TYPE.ADDED,
            category: CHANGE_CATEGORY.STATUS_CODE,
            path: newEp.path,
            method: newEp.method,
            statusCode: sc,
            description: `新增状态码 ${sc}`
          });
        } else if (oldResp && !newResp) {
          changes.push({
            type: CHANGE_TYPE.REMOVED,
            category: CHANGE_CATEGORY.STATUS_CODE,
            path: newEp.path,
            method: newEp.method,
            statusCode: sc,
            description: `删除状态码 ${sc}`
          });
        } else {
          if (oldResp.description !== newResp.description) {
            changes.push({
              type: CHANGE_TYPE.MODIFIED,
              category: CHANGE_CATEGORY.STATUS_CODE,
              path: newEp.path,
              method: newEp.method,
              statusCode: sc,
              field: 'description',
              oldValue: oldResp.description,
              newValue: newResp.description,
              description: `状态码 ${sc} 描述变更`,
              infoOnly: true
            });
          }

          const respChanges = compareSchemas(
            oldResp.schema,
            newResp.schema,
            oldSpec,
            newSpec,
            `response.${sc}`
          );
          for (const rc of respChanges) {
            rc.path = newEp.path;
            rc.method = newEp.method;
            rc.statusCode = sc;
            rc.category = CHANGE_CATEGORY.RESPONSE;
            changes.push(rc);
          }
        }
      }

      const oldSummaryText = oldEp.summary || '';
      const newSummaryText = newEp.summary || '';
      if (oldSummaryText !== newSummaryText) {
        changes.push({
          type: CHANGE_TYPE.MODIFIED,
          category: CHANGE_CATEGORY.ENDPOINT,
          path: newEp.path,
          method: newEp.method,
          field: 'summary',
          oldValue: oldSummaryText,
          newValue: newSummaryText,
          description: `接口摘要变更`,
          infoOnly: true
        });
      }

      const oldDescText = oldEp.description || '';
      const newDescText = newEp.description || '';
      if (oldDescText !== newDescText) {
        changes.push({
          type: CHANGE_TYPE.MODIFIED,
          category: CHANGE_CATEGORY.ENDPOINT,
          path: newEp.path,
          method: newEp.method,
          field: 'description',
          oldValue: oldDescText,
          newValue: newDescText,
          description: `接口描述变更`,
          infoOnly: true
        });
      }
    }
  }

  return changes;
}

function compareSchemasGlobal(oldSummary, newSummary, oldSpec, newSpec) {
  const changes = [];
  const oldSchemas = oldSummary.schemas || {};
  const newSchemas = newSummary.schemas || {};

  const allNames = new Set([...Object.keys(oldSchemas), ...Object.keys(newSchemas)]);

  for (const name of allNames) {
    const oldSchema = oldSchemas[name];
    const newSchema = newSchemas[name];

    if (!oldSchema && newSchema) {
      changes.push({
        type: CHANGE_TYPE.ADDED,
        category: CHANGE_CATEGORY.SCHEMA,
        schemaName: name,
        description: `新增Schema '${name}'`
      });
    } else if (oldSchema && !newSchema) {
      changes.push({
        type: CHANGE_TYPE.REMOVED,
        category: CHANGE_CATEGORY.SCHEMA,
        schemaName: name,
        description: `删除Schema '${name}'`
      });
    } else {
      const propChanges = compareSchemas(
        { properties: oldSchema.properties, required: oldSchema.required },
        { properties: newSchema.properties, required: newSchema.required },
        oldSpec,
        newSpec,
        name
      );
      for (const pc of propChanges) {
        pc.schemaName = name;
        pc.category = CHANGE_CATEGORY.SCHEMA_PROPERTY;
        changes.push(pc);
      }

      if (oldSchema.type !== newSchema.type) {
        changes.push({
          type: CHANGE_TYPE.MODIFIED,
          category: CHANGE_CATEGORY.SCHEMA,
          schemaName: name,
          field: 'type',
          oldValue: oldSchema.type,
          newValue: newSchema.type,
          description: `Schema '${name}' 类型变更: ${oldSchema.type} → ${newSchema.type}`
        });
      }
    }
  }

  return changes;
}

function compareSecurity(oldSummary, newSummary) {
  const changes = [];
  const oldSec = oldSummary.securitySchemes || {};
  const newSec = newSummary.securitySchemes || {};

  const allNames = new Set([...Object.keys(oldSec), ...Object.keys(newSec)]);

  for (const name of allNames) {
    const oldScheme = oldSec[name];
    const newScheme = newSec[name];

    if (!oldScheme && newScheme) {
      changes.push({
        type: CHANGE_TYPE.ADDED,
        category: CHANGE_CATEGORY.SECURITY,
        securityName: name,
        description: `新增安全方案 '${name}'`
      });
    } else if (oldScheme && !newScheme) {
      changes.push({
        type: CHANGE_TYPE.REMOVED,
        category: CHANGE_CATEGORY.SECURITY,
        securityName: name,
        description: `删除安全方案 '${name}'`
      });
    }
  }

  return changes;
}

function diffSpecs(oldSpec, newSpec) {
  const oldSummary = generateSummary(oldSpec);
  const newSummary = generateSummary(newSpec);

  const endpointChanges = compareEndpoints(oldSummary, newSummary, oldSpec, newSpec);
  const schemaChanges = compareSchemasGlobal(oldSummary, newSummary, oldSpec, newSpec);
  const securityChanges = compareSecurity(oldSummary, newSummary);

  const allChanges = [...endpointChanges, ...schemaChanges, ...securityChanges];

  return {
    oldSummary,
    newSummary,
    changes: allChanges,
    stats: {
      totalChanges: allChanges.length,
      added: allChanges.filter(c => c.type === CHANGE_TYPE.ADDED).length,
      removed: allChanges.filter(c => c.type === CHANGE_TYPE.REMOVED).length,
      modified: allChanges.filter(c => c.type === CHANGE_TYPE.MODIFIED).length
    }
  };
}

function diffFiles(oldPath, newPath) {
  const oldSpec = loadSpec(oldPath);
  const newSpec = loadSpec(newPath);
  return diffSpecs(oldSpec, newSpec);
}

module.exports = {
  CHANGE_TYPE,
  CHANGE_CATEGORY,
  diffSpecs,
  diffFiles,
  compareEndpoints,
  compareParameters,
  compareSchemas
};
