/**
 * Interface for contextual information that will be provided in the init callback.
 */
export interface AddinClientInitArgs {

  /**
   * The environment id of the host page.
   */
  envId?: string;

  /**
   * Additional context of the host page, which will vary for different
   * extensibility points.
   */
  context?: any;

}
