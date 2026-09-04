import { Framework, MoveStyleUtils, Rock, RockInstanceContext, RuiRockLogger, handleComponentEvent } from "@ruiapp/move-style";
import { toRenderRockSlot, convertToEventHandlers, convertToSlotProps, renderRock, renderRockSlot } from "@ruiapp/react-renderer";
import { Table, TableProps } from "antd";
import { ColumnType } from "antd/lib/table/interface";
import { filter, get, isFunction, isNumber, isString, map, merge, omit, reduce, some, sum, trim } from "lodash";
import RapidTableMeta from "./RapidTableMeta";
import { RapidTableRockConfig } from "./rapid-table-types";
import { parseRockExpressionFunc } from "../../utils/parse-utility";
import { memo, useEffect, useRef, useState } from "react";
import VirtualTable from "./VirtualTable";
import { RapidTableColumnConfig, RapidTableColumnRockConfig } from "../rapid-table-column/rapid-table-column-types";
import { roundWithPrecision } from "../../utils/number-utility";

const ExpandedRowComponent = memo<Record<string, any>>((props) => {
  const { expandedRow, record, index, context } = props;

  const page = context.page;
  const slotProps = { record, index };

  if (expandedRow.$exps) {
    page.interpreteComponentProperties(null, expandedRow, { $slot: slotProps });
  }

  return renderRock({
    context,
    rockConfig: {
      $id: `${record.id}_expandedRow`,
      ...expandedRow,
    },
    expVars: {
      $slot: slotProps,
    },
    fixedProps: {
      $slot: slotProps,
    },
  }) as any;
});

function getColumnDataIndex(column: RapidTableColumnRockConfig) {
  return (column.fieldName || column.code).split(".");
}

export function convertRapidTableColumnToAntdTableColumn(
  logger: RuiRockLogger,
  framework: Framework,
  context: RockInstanceContext,
  column: RapidTableColumnRockConfig,
) {
  MoveStyleUtils.localizeConfigProps(framework, logger.getInternalLogger(), column);

  if (column.children) {
    return {
      ...MoveStyleUtils.omitSystemRockConfigFields(column),
      children: map(column.children, (childColumn) => convertRapidTableColumnToAntdTableColumn(logger, framework, context, childColumn)),
    };
  }

  let render: ColumnType<any>["render"];

  if (isFunction(column.render)) {
    render = column.render;
  } else if (isString(column.render)) {
    render = (value, record, index) => {
      return context.page.interpreteExpression(column.render as string, {
        value,
        record,
        index,
        $scope: context.scope,
      });
    };
  } else if (column.format) {
    render = (value, record, index) => {
      return MoveStyleUtils.fulfillVariablesInString(column.format, record);
    };
  } else if (column.cell) {
    render = toRenderRockSlot({ context, slot: column.cell, rockType: column.$type, slotPropName: "cell" });
  } else if (column.rendererType) {
    const rendererType = column.rendererType;
    const cell = {
      $type: rendererType,
      ...column.rendererProps,
      $exps: {
        value: "$slot.value",
        ...(column.rendererProps?.$exps || {}),
      },
    };
    render = toRenderRockSlot({ context, slot: cell, rockType: column.$type, slotPropName: "cell" });
  } else {
    // default renderer
  }

  return {
    ...MoveStyleUtils.omitSystemRockConfigFields(column),
    dataIndex: getColumnDataIndex(column),
    key: column.key || column.fieldName || column.code,
    render,
  } as ColumnType<any>;
}

export function calculateColumnsTotalWidth(columns: RapidTableColumnConfig[]) {
  return reduce(
    columns,
    (accumulatedWidth, column) => {
      let columnWidth: number;
      if (isString(column.width)) {
        columnWidth = parseInt(column.width, 10);
      } else {
        columnWidth = column.width;
      }

      let columnMinWidth: number;
      if (isString(column.minWidth)) {
        columnMinWidth = parseInt(column.minWidth, 10);
      } else {
        columnMinWidth = column.minWidth;
      }

      return accumulatedWidth + (columnWidth || columnMinWidth || 100);
    },
    0,
  );
}

export default {
  Renderer(context, props: RapidTableRockConfig) {
    const { framework, logger, page, scope } = context;

    const tableRef = useRef<any>(null);

    const [tableHeight, setTableHeight] = useState<number | undefined>(undefined);

    const { window, document } = global;

    const updateTableHeight = () => {
      if (!tableRef.current || !props.tableAutoHeight) {
        return;
      }

      const viewPortHeight = window?.innerHeight || document?.documentElement.clientHeight || document?.body.clientHeight;

      const tableElement = tableRef.current;

      if (tableElement.offsetParent === null) {
        return;
      }

      const tableHeader = tableElement.querySelector?.(".ant-table-thead");

      let tableBodyTop;

      if (tableHeader) {
        const headerRect = tableHeader.getBoundingClientRect();

        if (headerRect.height === 0 || headerRect.bottom <= 0) {
          return;
        }

        tableBodyTop = headerRect.bottom;
      } else {
        const tableRect = tableElement.getBoundingClientRect();

        if (tableRect.height === 0 || tableRect.top < 0) {
          return;
        }

        tableBodyTop = tableRect.top;
      }

      const newTableHeight = viewPortHeight - tableBodyTop - 88;

      if (newTableHeight > 0) {
        setTableHeight((oldTableHeight) => {
          if (oldTableHeight === newTableHeight) {
            return oldTableHeight;
          }

          return newTableHeight;
        });
      }
    };

    useEffect(() => {
      if (!props.tableAutoHeight || !tableRef.current) {
        return;
      }

      updateTableHeight();

      const tableElement = tableRef.current;

      const resizeObserver = new ResizeObserver(() => {
        updateTableHeight();
      });

      const entityListElement = tableElement.closest?.(".sonic-entity-list");

      const pageSectionElement = tableElement.closest?.(".rui-page-section");

      if (entityListElement) {
        resizeObserver.observe(entityListElement);
      }

      if (pageSectionElement && pageSectionElement !== entityListElement) {
        resizeObserver.observe(pageSectionElement);
      }

      return () => {
        resizeObserver.disconnect();
      };
    }, [props.tableAutoHeight]);

    const columns = filter(props.columns, (column) => !column._hidden);

    const tableColumns = map(columns, (column) => convertRapidTableColumnToAntdTableColumn(logger, framework, context, column));
    const columnsTotalWidth = calculateColumnsTotalWidth(columns);

    const eventHandlers = convertToEventHandlers({ context, rockConfig: props });
    const slotProps = convertToSlotProps({ context, rockConfig: props, slotsMeta: RapidTableMeta.slots });

    let dataSource = props.dataSource;
    if (props.convertListToTree) {
      dataSource = MoveStyleUtils.listToTree(props.dataSource, {
        listIdField: props.listIdField,
        listParentField: props.listParentField,
        treeChildrenField: props.treeChildrenField,
        topParentValue: props.treeTopParentValue,
      } as any);
    } else if (typeof props.dataSourceAdapter === "string" && trim(props.dataSourceAdapter)) {
      const adapter = parseRockExpressionFunc(props.dataSourceAdapter, { data: dataSource }, context);
      dataSource = adapter();
    }

    let expandable: any = null;
    if (props.expandedRow) {
      expandable = {
        expandedRowRender: (record, index) => {
          const expandedRow = { ...props.expandedRow };

          let recordKey: string;

          let rowKey: any = props.rowKey || "id";
          if (typeof rowKey === "function") {
            recordKey = rowKey(record, index);
          } else {
            recordKey = get(record, rowKey);
          }

          return <ExpandedRowComponent key={recordKey} expandedRow={expandedRow} record={record} index={index} context={context} />;
        },
      };
    }

    const antdProps: TableProps<any> = {
      ...omit(merge({ expandable }, MoveStyleUtils.omitSystemRockConfigFields(props)), "expandedRow"),
      ...eventHandlers,
      ...slotProps,
      dataSource: dataSource,
      rowKey: props.rowKey || "id",
      pagination: props.pagination
        ? {
            showSizeChanger: false,
            ...props.pagination,
          }
        : props.pagination,
      columns: tableColumns,
      scroll: {
        x: columnsTotalWidth,
        y: props.height || tableHeight,
      },
    };

    let summaryRenderer: any;
    if (dataSource && dataSource.length && some(columns, (item) => !!item.summaryMethod)) {
      summaryRenderer = (records: any[]) => {
        return (
          <Table.Summary.Row>
            {columns.map((column, index) => {
              let summaryResult = "";
              if (column.summaryMethod === "sum") {
                summaryResult = roundWithPrecision(sum(map(dataSource, (record) => get(record, getColumnDataIndex(column)))) || 0, 4).toString();
              }

              let summaryCellContent = summaryResult;
              if (column.summaryRendererType) {
                summaryCellContent = renderRock({
                  context,
                  rockConfig: {
                    $id: `${props.$id}-summaryContent-${index}`,
                    $type: column.summaryRendererType,
                    ...column.summaryRendererProps,
                    value: summaryResult,
                  },
                });
              }
              return (
                <Table.Summary.Cell key={index} index={index}>
                  {summaryCellContent}
                </Table.Summary.Cell>
              );
            })}
          </Table.Summary.Row>
        );
      };
      antdProps.summary = summaryRenderer;
    }

    const onRow: TableProps<any>["onRow"] = (record) => {
      return {
        onClick: (event) => {
          if (props.onRowClick) {
            handleComponentEvent("onRowClick", framework, page, scope, props, props.onRowClick, [{ record }]);
          }
        },
      };
    };

    if (props.virtual) {
      return <VirtualTable {...antdProps} onRow={onRow} />;
    }

    return <Table ref={tableRef} className="rapid-table" {...antdProps} onRow={onRow}></Table>;
  },

  ...RapidTableMeta,
} as Rock;
